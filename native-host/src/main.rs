//! pixels-roll20-helper — native messaging host that bridges Pixels dice
//! Bluetooth notifications to the Pixels Roll20 browser extension on
//! browsers without Web Bluetooth (Firefox).
//!
//! Two modes:
//! - Default: speaks the native messaging framing (4-byte LE length prefix +
//!   JSON) on stdin/stdout, as launched by the browser via runtime.connectNative().
//! - `--cli`: auto-connects and prints human-readable events to stdout, for
//!   verifying BLE behavior standalone (see PROTOCOL.md and native-host/README.md).

mod ble;
mod protocol;

use anyhow::Result;
use ble::{BleService, Command as BleCommand};
use protocol::{HostCommand, HostEvent};
use std::io::{self, Write};
use std::thread;
use tokio::sync::mpsc;

fn main() -> Result<()> {
    let cli_mode = std::env::args().any(|a| a == "--cli");

    let runtime = tokio::runtime::Runtime::new()?;
    runtime.block_on(async_main(cli_mode))
}

async fn async_main(cli_mode: bool) -> Result<()> {
    let (cmd_tx, cmd_rx) = mpsc::unbounded_channel::<BleCommand>();
    let (evt_tx, evt_rx) = mpsc::unbounded_channel::<HostEvent>();

    let service = BleService::new(evt_tx).await?;

    if cli_mode {
        spawn_cli_output_thread(evt_rx);
        eprintln!("pixels-roll20-helper: CLI mode — scanning for Pixels dice (Ctrl+C to quit)");
        let _ = cmd_tx.send(BleCommand::Connect);

        let run_handle = tokio::spawn(service.run(cmd_rx));
        tokio::signal::ctrl_c().await.ok();
        // Dropping the last sender closes the command channel, which makes
        // BleService::run() disconnect everything and return.
        drop(cmd_tx);
        let _ = run_handle.await;
    } else {
        spawn_stdin_thread(cmd_tx);
        spawn_stdout_thread(evt_rx);
        service.run(cmd_rx).await?;
    }

    Ok(())
}

fn spawn_stdin_thread(cmd_tx: mpsc::UnboundedSender<BleCommand>) {
    thread::spawn(move || {
        let stdin = io::stdin();
        let mut handle = stdin.lock();
        loop {
            match protocol::read_message(&mut handle) {
                Ok(Some(bytes)) => match serde_json::from_slice::<HostCommand>(&bytes) {
                    Ok(HostCommand::Connect) => {
                        let _ = cmd_tx.send(BleCommand::Connect);
                    }
                    Ok(HostCommand::Disconnect) => {
                        let _ = cmd_tx.send(BleCommand::Disconnect);
                    }
                    Ok(HostCommand::Status) => {
                        let _ = cmd_tx.send(BleCommand::Status);
                    }
                    Err(e) => eprintln!("pixels-roll20-helper: bad message: {e}"),
                },
                Ok(None) => break, // browser closed the pipe
                Err(e) => {
                    eprintln!("pixels-roll20-helper: stdin read error: {e}");
                    break;
                }
            }
        }
        // cmd_tx drops here, signaling BleService::run() to shut down.
    });
}

fn spawn_stdout_thread(mut evt_rx: mpsc::UnboundedReceiver<HostEvent>) {
    thread::spawn(move || {
        let stdout = io::stdout();
        let mut handle = stdout.lock();
        while let Some(event) = evt_rx.blocking_recv() {
            match serde_json::to_vec(&event) {
                Ok(bytes) => {
                    if protocol::write_message(&mut handle, &bytes).is_err() {
                        break;
                    }
                }
                Err(e) => eprintln!("pixels-roll20-helper: failed to serialize event: {e}"),
            }
        }
    });
}

fn spawn_cli_output_thread(mut evt_rx: mpsc::UnboundedReceiver<HostEvent>) {
    thread::spawn(move || {
        while let Some(event) = evt_rx.blocking_recv() {
            match event {
                HostEvent::DieConnected { id, name } => {
                    println!("[connected]    {name} ({id})");
                }
                HostEvent::DieDisconnected { id, name } => {
                    println!("[disconnected] {name} ({id})");
                }
                HostEvent::Notification { id, name, data } => {
                    if data.len() == 3 && data[0] == 3 {
                        println!(
                            "[roll]         {name} ({id}) face up = {}",
                            data[2].wrapping_add(1)
                        );
                    } else {
                        println!("[notify]       {name} ({id}) data = {data:?}");
                    }
                }
                HostEvent::ScanDone { found } => {
                    println!("[scan]         found {found} die/dice so far");
                }
                HostEvent::Error { message } => {
                    println!("[error]        {message}");
                }
                HostEvent::Status { dice } => {
                    println!("[status]       {} die/dice tracked", dice.len());
                    for d in dice {
                        println!(
                            "               - {} ({}) connected={}",
                            d.name, d.id, d.connected
                        );
                    }
                }
            }
            let _ = io::stdout().flush();
        }
    });
}
