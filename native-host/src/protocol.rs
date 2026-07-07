//! Native messaging wire format: 4-byte little-endian length prefix + UTF-8 JSON,
//! and the JSON message shapes exchanged with the extension. See PROTOCOL.md.

use anyhow::{bail, Result};
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};

/// Firefox enforces a 1MB native-message size limit; our messages are tiny, so
/// anything near that is a framing bug rather than a legitimate payload.
const MAX_MESSAGE_BYTES: u32 = 1024 * 1024;

#[derive(Debug, Deserialize)]
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
