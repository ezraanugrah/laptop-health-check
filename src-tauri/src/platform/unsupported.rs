//! Fallback untuk OS yang belum didukung (Linux ditunda).

use super::{Platform, ProbeError};
use crate::diagnostics::types::SystemOverview;

pub struct Unsupported;

impl Platform for Unsupported {
    fn system_overview() -> Result<SystemOverview, ProbeError> {
        Err(ProbeError::new(format!(
            "Sistem operasi '{}' belum didukung",
            std::env::consts::OS
        )))
    }
}
