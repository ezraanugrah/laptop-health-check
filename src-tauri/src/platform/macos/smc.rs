//! Klien SMC (System Management Controller) — **HANYA MEMBACA**.
//!
//! Perintah yang didefinisikan hanya:
//! - `READ_KEYINFO` (9): tipe & ukuran sebuah kunci
//! - `READ_BYTES`   (5): nilai sebuah kunci
//! - `READ_INDEX`   (8): nama kunci ke-n (untuk enumerasi)
//!
//! Perintah tulis SMC sengaja TIDAK didefinisikan di kode ini, sehingga
//! aplikasi tidak mungkin mengubah kipas, daya, atau konfigurasi hardware.
//! SMC tidak didokumentasikan Apple: bila layanan tidak ada/tidak kompatibel,
//! semua fungsi mengembalikan `ProbeError` (ditampilkan sebagai "Tidak diketahui").

use std::ffi::{c_char, c_void};
use std::mem::size_of;

use crate::platform::ProbeError;

type KernReturn = i32;
type MachPort = u32;

#[link(name = "IOKit", kind = "framework")]
unsafe extern "C" {
    fn IOServiceMatching(name: *const c_char) -> *mut c_void;
    fn IOServiceGetMatchingService(main_port: MachPort, matching: *mut c_void) -> u32;
    fn IOServiceOpen(
        service: u32,
        owning_task: MachPort,
        kind: u32,
        connect: *mut u32,
    ) -> KernReturn;
    fn IOServiceClose(connect: u32) -> KernReturn;
    fn IOObjectRelease(object: u32) -> KernReturn;
    fn IOConnectCallStructMethod(
        connection: u32,
        selector: u32,
        input: *const c_void,
        input_size: usize,
        output: *mut c_void,
        output_size: *mut usize,
    ) -> KernReturn;
}

unsafe extern "C" {
    static mach_task_self_: MachPort;
}

/// Selector user client AppleSMC untuk pertukaran struct parameter.
const KERNEL_INDEX_SMC: u32 = 2;
const CMD_READ_BYTES: u8 = 5;
const CMD_READ_INDEX: u8 = 8;
const CMD_READ_KEYINFO: u8 = 9;

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct KeyDataVersion {
    major: u8,
    minor: u8,
    build: u8,
    reserved: u8,
    release: u16,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct KeyDataPowerLimit {
    version: u16,
    length: u16,
    cpu_p_limit: u32,
    gpu_p_limit: u32,
    mem_p_limit: u32,
}

#[repr(C)]
#[derive(Clone, Copy, Default)]
struct KeyInfo {
    data_size: u32,
    data_type: u32,
    data_attributes: u8,
}

/// Struct parameter SMC (`SMCParamStruct`), wajib tepat 80 byte.
#[repr(C)]
#[derive(Clone, Copy, Default)]
struct KeyData {
    key: u32,
    version: KeyDataVersion,
    power_limit: KeyDataPowerLimit,
    key_info: KeyInfo,
    result: u8,
    status: u8,
    data8: u8,
    data32: u32,
    bytes: [u8; 32],
}

const _: () = assert!(size_of::<KeyData>() == 80);

/// Nilai mentah sebuah kunci SMC.
#[derive(Debug, Clone, PartialEq)]
pub struct SmcValue {
    /// Tipe data empat karakter, mis. "sp78", "fpe2", "flt ".
    pub data_type: String,
    pub bytes: Vec<u8>,
}

/// Koneksi read-only ke AppleSMC; ditutup otomatis saat di-drop.
pub struct Smc {
    connection: u32,
}

impl Smc {
    pub fn open() -> Result<Self, ProbeError> {
        for name in [c"AppleSMC", c"AppleSMCKeysEndpoint"] {
            // SAFETY: argumen sesuai prototipe IOKit; `matching` dikonsumsi oleh
            // IOServiceGetMatchingService; `service` dilepas setelah dibuka.
            unsafe {
                let matching = IOServiceMatching(name.as_ptr());
                if matching.is_null() {
                    continue;
                }
                let service = IOServiceGetMatchingService(0, matching);
                if service == 0 {
                    continue;
                }
                let mut connection = 0;
                let kr = IOServiceOpen(service, mach_task_self_, 0, &mut connection);
                IOObjectRelease(service);
                if kr == 0 && connection != 0 {
                    return Ok(Self { connection });
                }
            }
        }
        Err(ProbeError::new(
            "Layanan SMC tidak dapat dibuka (tidak tersedia atau tidak kompatibel di perangkat ini)",
        ))
    }

    fn call(&self, input: &KeyData) -> Result<KeyData, ProbeError> {
        let mut output = KeyData::default();
        let mut output_size = size_of::<KeyData>();
        // SAFETY: input/output menunjuk struct 80 byte yang valid selama panggilan.
        let kr = unsafe {
            IOConnectCallStructMethod(
                self.connection,
                KERNEL_INDEX_SMC,
                (input as *const KeyData).cast::<c_void>(),
                size_of::<KeyData>(),
                (&mut output as *mut KeyData).cast::<c_void>(),
                &mut output_size,
            )
        };
        if kr != 0 {
            return Err(ProbeError::new(format!(
                "panggilan SMC gagal (kode {kr:#x})"
            )));
        }
        if output.result != 0 {
            return Err(ProbeError::new(format!(
                "SMC menolak permintaan (result {})",
                output.result
            )));
        }
        Ok(output)
    }

    fn key_info(&self, key: u32) -> Result<KeyInfo, ProbeError> {
        let input = KeyData {
            key,
            data8: CMD_READ_KEYINFO,
            ..KeyData::default()
        };
        Ok(self.call(&input)?.key_info)
    }

    /// Membaca nilai mentah sebuah kunci, mis. `"TC0P"`.
    pub fn read(&self, key: &str) -> Result<SmcValue, ProbeError> {
        let code =
            fourcc(key).ok_or_else(|| ProbeError::new(format!("kunci SMC tidak valid: {key}")))?;
        let info = self.key_info(code)?;
        let size = (info.data_size as usize).min(32);
        let input = KeyData {
            key: code,
            key_info: KeyInfo {
                data_size: info.data_size,
                ..KeyInfo::default()
            },
            data8: CMD_READ_BYTES,
            ..KeyData::default()
        };
        let output = self.call(&input)?;
        Ok(SmcValue {
            data_type: fourcc_to_string(info.data_type),
            bytes: output.bytes[..size].to_vec(),
        })
    }

    /// Jumlah kunci yang tersedia (`#KEY`).
    pub fn key_count(&self) -> Result<u32, ProbeError> {
        let value = self.read("#KEY")?;
        decode(&value)
            .map(|n| n as u32)
            .ok_or_else(|| ProbeError::new("jumlah kunci SMC tidak terbaca"))
    }

    /// Nama kunci ke-`index` (enumerasi).
    pub fn key_at(&self, index: u32) -> Result<String, ProbeError> {
        let input = KeyData {
            data8: CMD_READ_INDEX,
            data32: index,
            ..KeyData::default()
        };
        Ok(fourcc_to_string(self.call(&input)?.key))
    }
}

impl Drop for Smc {
    fn drop(&mut self) {
        // SAFETY: koneksi dibuka oleh IOServiceOpen dan hanya ditutup sekali.
        unsafe {
            IOServiceClose(self.connection);
        }
    }
}

/// "TC0P" -> kode u32 big-endian.
pub fn fourcc(key: &str) -> Option<u32> {
    let bytes: [u8; 4] = key.as_bytes().try_into().ok()?;
    Some(u32::from_be_bytes(bytes))
}

pub fn fourcc_to_string(code: u32) -> String {
    code.to_be_bytes().iter().map(|&b| b as char).collect()
}

/// Mendekode nilai numerik SMC. Tipe yang tidak dikenal -> `None` (tanpa tebakan).
pub fn decode(value: &SmcValue) -> Option<f64> {
    let b = &value.bytes;
    let be16 = || Some(u16::from_be_bytes([*b.first()?, *b.get(1)?]));
    let t = value.data_type.as_str();
    match t {
        "ui8 " => b.first().map(|&v| f64::from(v)),
        "ui16" => be16().map(f64::from),
        "ui32" => Some(f64::from(u32::from_be_bytes(b.get(..4)?.try_into().ok()?))),
        // Apple Silicon: float 32-bit little-endian.
        "flt " => Some(f64::from(f32::from_le_bytes(b.get(..4)?.try_into().ok()?))),
        // Fixed-point: "spXY" bertanda / "fpXY" tanpa tanda, Y = jumlah bit pecahan (hex).
        _ if t.len() == 4 && (t.starts_with("sp") || t.starts_with("fp")) => {
            let frac_bits = u32::from_str_radix(&t[3..4], 16).ok()?;
            let raw = be16()?;
            let value = if t.starts_with("sp") {
                f64::from(raw as i16)
            } else {
                f64::from(raw)
            };
            Some(value / f64::from(1u32 << frac_bits))
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v(data_type: &str, bytes: &[u8]) -> SmcValue {
        SmcValue {
            data_type: data_type.into(),
            bytes: bytes.to_vec(),
        }
    }

    #[test]
    fn struct_layout_matches_kernel_abi() {
        assert_eq!(size_of::<KeyData>(), 80);
    }

    #[test]
    fn fourcc_roundtrip() {
        let code = fourcc("TC0P").unwrap();
        assert_eq!(fourcc_to_string(code), "TC0P");
        assert_eq!(fourcc("TOOLONG"), None);
    }

    #[test]
    fn decodes_known_types() {
        // sp78: 0x3A80 = 58.5 °C
        assert_eq!(decode(&v("sp78", &[0x3A, 0x80])), Some(58.5));
        // sp78 negatif
        assert_eq!(decode(&v("sp78", &[0xFF, 0x00])), Some(-1.0));
        // fpe2: 0x1C20 / 4 = 1800 RPM
        assert_eq!(decode(&v("fpe2", &[0x1C, 0x20])), Some(1800.0));
        assert_eq!(decode(&v("ui8 ", &[2])), Some(2.0));
        assert_eq!(decode(&v("ui16", &[0x01, 0x00])), Some(256.0));
        assert_eq!(decode(&v("ui32", &[0, 0, 0x05, 0xDC])), Some(1500.0));
        assert_eq!(decode(&v("flt ", &1234.5f32.to_le_bytes())), Some(1234.5));
    }

    #[test]
    fn unknown_or_short_values_are_none() {
        assert_eq!(decode(&v("ch8*", b"abcd")), None);
        assert_eq!(decode(&v("sp78", &[0x3A])), None);
        assert_eq!(decode(&v("flt ", &[0, 0])), None);
    }
}
