//! Native messaging wire format: 4-byte little-endian length prefix + UTF-8 JSON,
//! and the JSON message shapes exchanged with the extension. See PROTOCOL.md.

use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};

/// Firefox enforces a 1MB native-message size limit; our messages are tiny, so
/// anything near that is a framing bug rather than a legitimate payload.
const MAX_MESSAGE_BYTES: u32 = 1024 * 1024;

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(tag = "cmd", rename_all = "camelCase")]
pub enum HostCommand {
    Connect,
    Disconnect,
    Status,
}

#[derive(Debug, Serialize, Clone)]
pub struct DieStatus {
    pub id: String,
    pub name: String,
    pub connected: bool,
}

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "event", rename_all = "camelCase")]
pub enum HostEvent {
    DieConnected { id: String, name: String },
    DieDisconnected { id: String, name: String },
    Notification { id: String, name: String, data: Vec<u8> },
    ScanDone { found: usize },
    Error { message: String },
    /// Not in the original protocol sketch, added so `{"cmd":"status"}` has a
    /// meaningful reply for the popup to render on (re)open.
    Status { dice: Vec<DieStatus> },
}

/// Reads one framed message from `reader`. Returns `Ok(None)` on clean EOF
/// (the browser closed the pipe), which callers treat as a shutdown signal.
pub fn read_message<R: Read>(reader: &mut R) -> Result<Option<Vec<u8>>> {
    let mut len_buf = [0u8; 4];
    match reader.read_exact(&mut len_buf) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e.into()),
    }

    let len = u32::from_le_bytes(len_buf);
    if len > MAX_MESSAGE_BYTES {
        bail!("framed message of {len} bytes exceeds max of {MAX_MESSAGE_BYTES}");
    }

    let mut buf = vec![0u8; len as usize];
    reader.read_exact(&mut buf)?;
    Ok(Some(buf))
}

pub fn write_message<W: Write>(writer: &mut W, payload: &[u8]) -> Result<()> {
    if payload.len() as u64 > MAX_MESSAGE_BYTES as u64 {
        bail!("outgoing message of {} bytes exceeds max", payload.len());
    }
    let len = payload.len() as u32;
    writer.write_all(&len.to_le_bytes())?;
    writer.write_all(payload)?;
    writer.flush()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn write_then_read_round_trips() {
        let mut buf = Vec::new();
        write_message(&mut buf, b"hello").unwrap();

        let mut cursor = Cursor::new(buf);
        let msg = read_message(&mut cursor).unwrap();

        assert_eq!(msg, Some(b"hello".to_vec()));
    }

    #[test]
    fn read_message_returns_none_on_clean_eof() {
        let mut cursor = Cursor::new(Vec::<u8>::new());
        assert_eq!(read_message(&mut cursor).unwrap(), None);
    }

    #[test]
    fn read_message_errors_on_truncated_body() {
        // Length prefix claims 10 bytes, but only 2 are actually present —
        // the browser closing mid-message should surface as an error, not
        // silently return a short/garbage message.
        let mut buf = Vec::new();
        buf.extend_from_slice(&10u32.to_le_bytes());
        buf.extend_from_slice(&[1, 2]);

        let mut cursor = Cursor::new(buf);
        assert!(read_message(&mut cursor).is_err());
    }

    #[test]
    fn read_message_rejects_oversized_length_prefix() {
        let mut buf = Vec::new();
        buf.extend_from_slice(&(MAX_MESSAGE_BYTES + 1).to_le_bytes());

        let mut cursor = Cursor::new(buf);
        let err = read_message(&mut cursor).unwrap_err();
        assert!(err.to_string().contains("exceeds max"));
    }

    #[test]
    fn write_message_rejects_oversized_payload() {
        let mut buf = Vec::new();
        let oversized = vec![0u8; MAX_MESSAGE_BYTES as usize + 1];

        let err = write_message(&mut buf, &oversized).unwrap_err();
        assert!(err.to_string().contains("exceeds max"));
    }

    #[test]
    fn deserializes_all_known_commands() {
        assert_eq!(
            serde_json::from_str::<HostCommand>(r#"{"cmd":"connect"}"#).unwrap(),
            HostCommand::Connect
        );
        assert_eq!(
            serde_json::from_str::<HostCommand>(r#"{"cmd":"disconnect"}"#).unwrap(),
            HostCommand::Disconnect
        );
        assert_eq!(
            serde_json::from_str::<HostCommand>(r#"{"cmd":"status"}"#).unwrap(),
            HostCommand::Status
        );
    }

    #[test]
    fn rejects_unknown_command() {
        assert!(serde_json::from_str::<HostCommand>(r#"{"cmd":"disco"}"#).is_err());
    }

    // These pin the exact wire shapes documented in PROTOCOL.md — a stray
    // #[serde(rename)] change here would silently break the extension side
    // without these failing.

    #[test]
    fn die_connected_serializes_to_documented_shape() {
        let event = HostEvent::DieConnected {
            id: "abc".to_string(),
            name: "Aurora".to_string(),
        };
        assert_eq!(
            serde_json::to_string(&event).unwrap(),
            r#"{"event":"dieConnected","id":"abc","name":"Aurora"}"#
        );
    }

    #[test]
    fn die_disconnected_serializes_to_documented_shape() {
        let event = HostEvent::DieDisconnected {
            id: "abc".to_string(),
            name: "Aurora".to_string(),
        };
        assert_eq!(
            serde_json::to_string(&event).unwrap(),
            r#"{"event":"dieDisconnected","id":"abc","name":"Aurora"}"#
        );
    }

    #[test]
    fn notification_serializes_data_as_a_plain_byte_array() {
        let event = HostEvent::Notification {
            id: "abc".to_string(),
            name: "Aurora".to_string(),
            data: vec![3, 1, 5],
        };
        assert_eq!(
            serde_json::to_string(&event).unwrap(),
            r#"{"event":"notification","id":"abc","name":"Aurora","data":[3,1,5]}"#
        );
    }

    #[test]
    fn scan_done_serializes_to_documented_shape() {
        let json = serde_json::to_string(&HostEvent::ScanDone { found: 2 }).unwrap();
        assert_eq!(json, r#"{"event":"scanDone","found":2}"#);
    }

    #[test]
    fn error_serializes_to_documented_shape() {
        let event = HostEvent::Error {
            message: "boom".to_string(),
        };
        assert_eq!(
            serde_json::to_string(&event).unwrap(),
            r#"{"event":"error","message":"boom"}"#
        );
    }

    #[test]
    fn status_serializes_to_documented_shape() {
        let event = HostEvent::Status {
            dice: vec![DieStatus {
                id: "abc".to_string(),
                name: "Aurora".to_string(),
                connected: true,
            }],
        };
        assert_eq!(
            serde_json::to_string(&event).unwrap(),
            r#"{"event":"status","dice":[{"id":"abc","name":"Aurora","connected":true}]}"#
        );
    }
}
