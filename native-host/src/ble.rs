//! Bluetooth handling for Pixels dice via btleplug.
//!
//! Mirrors the scan/connect/notify logic in
//! `src/content/modules/PixelsBluetooth.js` (UUIDs, notify-characteristic
//! fallback, reconnect-on-drop) but has no knowledge of roll formulas or chat
//! formatting — this crate only ever forwards raw notification bytes; all
//! parsing stays in the extension's `rollProcessor.js`.

use anyhow::{Context, Result};
use btleplug::api::{
    Central, CentralEvent, Characteristic, CharPropFlags, Manager as _, Peripheral as _,
    PeripheralProperties, ScanFilter, Service,
};
use btleplug::platform::{Adapter, Manager, Peripheral, PeripheralId};
use futures::StreamExt;
use std::collections::{BTreeSet, HashMap};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{mpsc, Mutex};
use uuid::{uuid, Uuid};

use crate::protocol::{DieStatus, HostEvent};

const PIXELS_SERVICE_UUID: Uuid = uuid!("a6b90001-7a5a-43f2-a962-350c8edc9b5b");
const PIXELS_NOTIFY_UUID: Uuid = uuid!("a6b90002-7a5a-43f2-a962-350c8edc9b5b");
const PIXELS_LEGACY_SERVICE_UUID: Uuid = uuid!("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
const PIXELS_LEGACY_NOTIFY_UUID: Uuid = uuid!("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
const NAME_PREFIX: &str = "Pixel";

const SCAN_WINDOW: Duration = Duration::from_secs(5);
const RECONNECT_BASE_DELAY: Duration = Duration::from_secs(2);
const RECONNECT_MAX_DELAY: Duration = Duration::from_secs(60);
const MAX_RECONNECT_ATTEMPTS: u32 = 10;

pub enum Command {
    Connect,
    Disconnect,
    Status,
}

#[derive(Clone)]
struct DieEntry {
    name: String,
    peripheral: Peripheral,
    connected: bool,
}

pub struct BleService {
    adapter: Adapter,
    events_out: mpsc::UnboundedSender<HostEvent>,
    dice: Arc<Mutex<HashMap<PeripheralId, DieEntry>>>,
}

impl BleService {
    pub async fn new(events_out: mpsc::UnboundedSender<HostEvent>) -> Result<Self> {
        let manager = Manager::new().await.context("failed to initialize BLE manager")?;
        let adapters = manager
            .adapters()
            .await
            .context("failed to list Bluetooth adapters")?;
        let adapter = adapters
            .into_iter()
            .next()
            .context("no Bluetooth adapter found on this machine")?;

        Ok(Self {
            adapter,
            events_out,
            dice: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    /// Runs until `commands` closes (i.e. the browser closed stdin), then
    /// disconnects everything before returning.
    pub async fn run(self, mut commands: mpsc::UnboundedReceiver<Command>) -> Result<()> {
        let mut central_events = self
            .adapter
            .events()
            .await
            .context("failed to subscribe to adapter events")?;

        loop {
            tokio::select! {
                cmd = commands.recv() => {
                    match cmd {
                        Some(Command::Connect) => self.start_scan().await,
                        Some(Command::Disconnect) => self.disconnect_all().await,
                        Some(Command::Status) => self.emit_status().await,
                        None => break,
                    }
                }
                event = central_events.next() => {
                    match event {
                        Some(evt) => self.handle_central_event(evt).await,
                        None => break,
                    }
                }
            }
        }

        self.disconnect_all().await;
        Ok(())
    }

    async fn start_scan(&self) {
        if let Err(e) = self.adapter.start_scan(ScanFilter::default()).await {
            self.emit(HostEvent::Error {
                message: format!("scan failed: {e}"),
            });
            return;
        }

        let adapter = self.adapter.clone();
        let dice = self.dice.clone();
        let events_out = self.events_out.clone();
        tokio::spawn(async move {
            tokio::time::sleep(SCAN_WINDOW).await;
            let _ = adapter.stop_scan().await;
            let found = dice.lock().await.len();
            let _ = events_out.send(HostEvent::ScanDone { found });
        });
    }

    async fn disconnect_all(&self) {
        let _ = self.adapter.stop_scan().await;
        let mut dice = self.dice.lock().await;
        for entry in dice.values() {
            let _ = entry.peripheral.disconnect().await;
        }
        dice.clear();
    }

    async fn emit_status(&self) {
        let dice = self.dice.lock().await;
        let list = dice
            .iter()
            .map(|(id, e)| DieStatus {
                id: id_string(id),
                name: e.name.clone(),
                connected: e.connected,
            })
            .collect();
        self.emit(HostEvent::Status { dice: list });
    }

    async fn handle_central_event(&self, event: CentralEvent) {
        match event {
            CentralEvent::DeviceDiscovered(id) | CentralEvent::DeviceUpdated(id) => {
                self.maybe_track_and_connect(id).await;
            }
            CentralEvent::DeviceDisconnected(id) => {
                self.on_disconnected(id).await;
            }
            // DeviceConnected is intentionally ignored: we already emit
            // DieConnected ourselves once subscribe succeeds, so acting on
            // this too would double-report.
            _ => {}
        }
    }

    async fn maybe_track_and_connect(&self, id: PeripheralId) {
        {
            let dice = self.dice.lock().await;
            if dice.contains_key(&id) {
                return;
            }
        }

        let Ok(peripheral) = self.adapter.peripheral(&id).await else {
            return;
        };

        let Ok(Some(props)) = peripheral.properties().await else {
            return;
        };

        if !is_pixels_die(&props) {
            return;
        }

        let name = props
            .local_name
            .clone()
            .unwrap_or_else(|| "Pixel".to_string());

        {
            let mut dice = self.dice.lock().await;
            dice.insert(
                id.clone(),
                DieEntry {
                    name: name.clone(),
                    peripheral: peripheral.clone(),
                    connected: false,
                },
            );
        }

        let dice = self.dice.clone();
        let events_out = self.events_out.clone();
        tokio::spawn(connect_with_retry(peripheral, id, name, dice, events_out, 0));
    }

    async fn on_disconnected(&self, id: PeripheralId) {
        let entry = {
            let mut dice = self.dice.lock().await;
            match dice.get_mut(&id) {
                Some(e) if e.connected => {
                    e.connected = false;
                    Some((e.peripheral.clone(), e.name.clone()))
                }
                _ => None,
            }
        };

        let Some((peripheral, name)) = entry else {
            return;
        };

        self.emit(HostEvent::DieDisconnected {
            id: id_string(&id),
            name: name.clone(),
        });

        let dice = self.dice.clone();
        let events_out = self.events_out.clone();
        tokio::spawn(connect_with_retry(peripheral, id, name, dice, events_out, 0));
    }

    fn emit(&self, event: HostEvent) {
        let _ = self.events_out.send(event);
    }
}

fn is_pixels_die(props: &PeripheralProperties) -> bool {
    let name_matches = props
        .local_name
        .as_ref()
        .map(|n| n.starts_with(NAME_PREFIX))
        .unwrap_or(false);

    let service_matches = props
        .services
        .iter()
        .any(|s| *s == PIXELS_SERVICE_UUID || *s == PIXELS_LEGACY_SERVICE_UUID);

    name_matches || service_matches
}

/// Connects, discovers the notify characteristic, subscribes, and (on
/// success) spawns a task forwarding raw notification bytes. On failure,
/// retries with exponential backoff up to `MAX_RECONNECT_ATTEMPTS` — this is
/// both the initial-connect path and the reconnect-after-drop path.
fn connect_with_retry(
    peripheral: Peripheral,
    id: PeripheralId,
    name: String,
    dice: Arc<Mutex<HashMap<PeripheralId, DieEntry>>>,
    events_out: mpsc::UnboundedSender<HostEvent>,
    attempt: u32,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send>> {
    Box::pin(async move {
        match connect_and_subscribe(&peripheral, &name, &events_out).await {
            Ok(()) => {
                if let Some(entry) = dice.lock().await.get_mut(&id) {
                    entry.connected = true;
                }
                let _ = events_out.send(HostEvent::DieConnected {
                    id: id_string(&id),
                    name: name.clone(),
                });
            }
            Err(e) => {
                let _ = events_out.send(HostEvent::Error {
                    message: format!("connect to {name} failed: {e}"),
                });

                if attempt < MAX_RECONNECT_ATTEMPTS {
                    tokio::time::sleep(backoff_delay(attempt)).await;
                    connect_with_retry(peripheral, id, name, dice, events_out, attempt + 1).await;
                } else {
                    // Give up tracking this die so a later scan (it may come
                    // back in range) starts a fresh attempt from 0, instead
                    // of being silently skipped forever as "already tracked".
                    dice.lock().await.remove(&id);
                    let _ = events_out.send(HostEvent::Error {
                        message: format!(
                            "giving up on {name} after {MAX_RECONNECT_ATTEMPTS} attempts"
                        ),
                    });
                }
            }
        }
    })
}

fn backoff_delay(attempt: u32) -> Duration {
    let millis = RECONNECT_BASE_DELAY.as_millis() as u64 * 2u64.saturating_pow(attempt.min(10));
    Duration::from_millis(millis).min(RECONNECT_MAX_DELAY)
}

async fn connect_and_subscribe(
    peripheral: &Peripheral,
    name: &str,
    events_out: &mpsc::UnboundedSender<HostEvent>,
) -> Result<()> {
    peripheral.connect().await.context("GATT connect failed")?;
    peripheral
        .discover_services()
        .await
        .context("service discovery failed")?;

    let characteristic = find_notify_characteristic(&peripheral.services())
        .context("no Pixels notify characteristic found on device")?;

    peripheral
        .subscribe(&characteristic)
        .await
        .context("subscribe to notify characteristic failed")?;

    let mut notifications = peripheral
        .notifications()
        .await
        .context("failed to obtain notification stream")?;

    let id = peripheral.id();
    let name = name.to_string();
    let events_out = events_out.clone();
    tokio::spawn(async move {
        while let Some(notification) = notifications.next().await {
            let _ = events_out.send(HostEvent::Notification {
                id: id_string(&id),
                name: name.clone(),
                data: notification.value,
            });
        }
    });

    Ok(())
}

/// Same fallback strategy as `findNotifyCharacteristic` in PixelsBluetooth.js:
/// try the known modern/legacy service + characteristic UUIDs first, then
/// fall back to any notifiable characteristic within a matching service, so
/// connection still works across firmware variants. Takes a plain service
/// set (rather than `&Peripheral`) so this stays pure and unit-testable
/// without a live BLE backend.
fn find_notify_characteristic(services: &BTreeSet<Service>) -> Option<Characteristic> {
    let candidates = [
        (PIXELS_SERVICE_UUID, PIXELS_NOTIFY_UUID),
        (PIXELS_LEGACY_SERVICE_UUID, PIXELS_LEGACY_NOTIFY_UUID),
    ];

    for (service_uuid, notify_uuid) in candidates {
        let Some(service) = services.iter().find(|s| s.uuid == service_uuid) else {
            continue;
        };

        if let Some(c) = service
            .characteristics
            .iter()
            .find(|c| c.uuid == notify_uuid && c.properties.contains(CharPropFlags::NOTIFY))
        {
            return Some(c.clone());
        }

        if let Some(c) = service
            .characteristics
            .iter()
            .find(|c| c.properties.contains(CharPropFlags::NOTIFY))
        {
            return Some(c.clone());
        }
    }

    None
}

/// PeripheralId has no stable cross-platform Display impl in btleplug, so we
/// use Debug formatting. It's deterministic per-device for the lifetime of
/// the process, which is all the extension needs to correlate events.
fn id_string(id: &PeripheralId) -> String {
    format!("{id:?}")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn props_with_name(name: &str) -> PeripheralProperties {
        PeripheralProperties {
            local_name: Some(name.to_string()),
            ..Default::default()
        }
    }

    fn props_with_service(uuid: Uuid) -> PeripheralProperties {
        PeripheralProperties {
            services: vec![uuid],
            ..Default::default()
        }
    }

    #[test]
    fn is_pixels_die_matches_on_name_prefix() {
        assert!(is_pixels_die(&props_with_name("Pixel Aurora")));
    }

    #[test]
    fn is_pixels_die_does_not_match_substring_names() {
        // Must start with "Pixel", not merely contain it.
        assert!(!is_pixels_die(&props_with_name("NotAPixelDie")));
    }

    #[test]
    fn is_pixels_die_matches_on_modern_service_uuid() {
        assert!(is_pixels_die(&props_with_service(PIXELS_SERVICE_UUID)));
    }

    #[test]
    fn is_pixels_die_matches_on_legacy_service_uuid() {
        assert!(is_pixels_die(&props_with_service(
            PIXELS_LEGACY_SERVICE_UUID
        )));
    }

    #[test]
    fn is_pixels_die_rejects_unrelated_devices() {
        let props = PeripheralProperties {
            local_name: Some("Some Other Device".to_string()),
            services: vec![uuid!("00001800-0000-1000-8000-00805f9b34fb")],
            ..Default::default()
        };
        assert!(!is_pixels_die(&props));
    }

    fn characteristic(uuid: Uuid, service_uuid: Uuid, notify: bool) -> Characteristic {
        Characteristic {
            uuid,
            service_uuid,
            properties: if notify {
                CharPropFlags::NOTIFY
            } else {
                CharPropFlags::READ
            },
            descriptors: Default::default(),
        }
    }

    fn service(uuid: Uuid, characteristics: Vec<Characteristic>) -> Service {
        Service {
            uuid,
            primary: true,
            characteristics: characteristics.into_iter().collect(),
        }
    }

    #[test]
    fn find_notify_characteristic_prefers_the_known_modern_uuid() {
        let services: BTreeSet<Service> = [service(
            PIXELS_SERVICE_UUID,
            vec![characteristic(PIXELS_NOTIFY_UUID, PIXELS_SERVICE_UUID, true)],
        )]
        .into_iter()
        .collect();

        let found = find_notify_characteristic(&services).unwrap();
        assert_eq!(found.uuid, PIXELS_NOTIFY_UUID);
    }

    #[test]
    fn find_notify_characteristic_falls_back_to_any_notifiable_characteristic() {
        // Simulates a firmware variant that doesn't use the documented
        // notify UUID — the fallback should still find *a* notifiable
        // characteristic in the matched service.
        let odd_uuid = uuid!("11111111-1111-1111-1111-111111111111");
        let services: BTreeSet<Service> = [service(
            PIXELS_SERVICE_UUID,
            vec![characteristic(odd_uuid, PIXELS_SERVICE_UUID, true)],
        )]
        .into_iter()
        .collect();

        let found = find_notify_characteristic(&services).unwrap();
        assert_eq!(found.uuid, odd_uuid);
    }

    #[test]
    fn find_notify_characteristic_uses_legacy_service_when_present() {
        let services: BTreeSet<Service> = [service(
            PIXELS_LEGACY_SERVICE_UUID,
            vec![characteristic(
                PIXELS_LEGACY_NOTIFY_UUID,
                PIXELS_LEGACY_SERVICE_UUID,
                true,
            )],
        )]
        .into_iter()
        .collect();

        let found = find_notify_characteristic(&services).unwrap();
        assert_eq!(found.uuid, PIXELS_LEGACY_NOTIFY_UUID);
    }

    #[test]
    fn find_notify_characteristic_returns_none_when_service_has_no_notifiable_characteristic() {
        let services: BTreeSet<Service> = [service(
            PIXELS_SERVICE_UUID,
            vec![characteristic(
                PIXELS_NOTIFY_UUID,
                PIXELS_SERVICE_UUID,
                false,
            )],
        )]
        .into_iter()
        .collect();

        assert!(find_notify_characteristic(&services).is_none());
    }

    #[test]
    fn find_notify_characteristic_returns_none_when_no_matching_service() {
        let battery_service = uuid!("0000180f-0000-1000-8000-00805f9b34fb");
        let battery_level = uuid!("00002a19-0000-1000-8000-00805f9b34fb");
        let services: BTreeSet<Service> = [service(
            battery_service,
            vec![characteristic(battery_level, battery_service, true)],
        )]
        .into_iter()
        .collect();

        assert!(find_notify_characteristic(&services).is_none());
    }

    #[test]
    fn backoff_delay_starts_at_the_base_delay() {
        assert_eq!(backoff_delay(0), RECONNECT_BASE_DELAY);
    }

    #[test]
    fn backoff_delay_doubles_each_attempt() {
        assert_eq!(backoff_delay(1), Duration::from_secs(4));
        assert_eq!(backoff_delay(2), Duration::from_secs(8));
    }

    #[test]
    fn backoff_delay_caps_at_the_max_delay() {
        assert_eq!(backoff_delay(5), RECONNECT_MAX_DELAY);
        // Large attempt counts must not overflow the exponent or panic.
        assert_eq!(backoff_delay(20), RECONNECT_MAX_DELAY);
    }
}
