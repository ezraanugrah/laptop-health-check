//! Pengumpul bukti untuk menentukan status sebuah pemeriksaan.

use super::types::{Reason, ReasonLevel, Status};

#[derive(Debug, Default)]
pub struct Findings {
    reasons: Vec<Reason>,
    critical: usize,
    warning: usize,
}

impl Findings {
    pub fn critical(&mut self, text: impl Into<String>) {
        self.critical += 1;
        self.push(ReasonLevel::Critical, text);
    }

    pub fn warning(&mut self, text: impl Into<String>) {
        self.warning += 1;
        self.push(ReasonLevel::Warning, text);
    }

    /// Bukti positif bahwa sesuatu dalam kondisi baik.
    pub fn ok(&mut self, text: impl Into<String>) {
        self.push(ReasonLevel::Ok, text);
    }

    /// Informasi netral, mis. data yang tidak tersedia.
    pub fn info(&mut self, text: impl Into<String>) {
        self.push(ReasonLevel::Info, text);
    }

    fn push(&mut self, level: ReasonLevel, text: impl Into<String>) {
        self.reasons.push(Reason {
            level,
            text: text.into(),
        });
    }

    /// Kritis > Peringatan > Sehat (hanya bila ada bukti inti) > Tidak diketahui.
    pub fn status(&self, has_core_evidence: bool) -> Status {
        if self.critical > 0 {
            Status::Critical
        } else if self.warning > 0 {
            Status::Warning
        } else if has_core_evidence {
            Status::Healthy
        } else {
            Status::Unknown
        }
    }

    /// Alasan terurut: kritis, peringatan, baik, info (stabil).
    pub fn into_reasons(mut self) -> Vec<Reason> {
        self.reasons.sort_by_key(|r| r.level);
        self.reasons
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn worst_finding_wins_and_reasons_are_sorted() {
        let mut f = Findings::default();
        f.ok("baik");
        f.warning("peringatan");
        f.info("info");
        f.critical("kritis");
        assert_eq!(f.status(true), Status::Critical);
        let levels: Vec<_> = f.into_reasons().iter().map(|r| r.level).collect();
        assert_eq!(
            levels,
            [
                ReasonLevel::Critical,
                ReasonLevel::Warning,
                ReasonLevel::Ok,
                ReasonLevel::Info
            ]
        );
    }

    #[test]
    fn healthy_requires_core_evidence() {
        let mut f = Findings::default();
        f.info("data tidak tersedia");
        assert_eq!(f.status(false), Status::Unknown);
        assert_eq!(f.status(true), Status::Healthy);
    }

    #[test]
    fn warning_without_critical() {
        let mut f = Findings::default();
        f.warning("w");
        assert_eq!(f.status(false), Status::Warning);
    }
}
