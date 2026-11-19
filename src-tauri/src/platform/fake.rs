//! Platform palsu KHUSUS TEST (`#[cfg(test)]`): tidak pernah ikut
//! dikompilasi ke aplikasi. Nilai di sini adalah data uji, bukan diagnosis.

use super::{Platform, ProbeError};
use crate::diagnostics::raw::{
    AudioDevice, AudioTransport, BatteryInfo, BluetoothInfo, CpuInfo, DiskInfo, FanReading,
    GpuInfo, MemoryInfo, MemoryModule, MemoryPressure, NetworkRoute, OwnershipInfo, PortsInfo,
    ReceptacleStatus, SensorKind, SensorReadings, SystemOverview, TemperatureReading,
    ThermalStatus, ThunderboltBus, ThunderboltReceptacle, TouchBarEvidence, UsbController,
    UsbDevice, VolumeSpace, WifiBand, WifiChannel, WifiInterfaceMode, WifiPhyMode, WifiStatus,
};
use crate::diagnostics::types::{CheckId, PlatformSupport, SupportLevel};

const GIB: u64 = 1024 * 1024 * 1024;

/// Semua data tersedia dan berada dalam batas sehat.
pub struct Healthy;

impl Platform for Healthy {
    fn system_overview() -> Result<SystemOverview, ProbeError> {
        Ok(SystemOverview {
            os_name: "macOS".into(),
            os_version: Some("15.0".into()),
            os_build: Some("24A335".into()),
            arch: "x86_64".into(),
            model: Some("TestModel1,1".into()),
            cpu: Some("Test CPU".into()),
            logical_cpus: Some(8),
            memory_bytes: Some(16 * GIB),
        })
    }

    fn battery() -> Result<Option<BatteryInfo>, ProbeError> {
        Ok(Some(BatteryInfo {
            design_capacity: Some(5000),
            full_charge_capacity: Some(4600),
            cycle_count: Some(100),
            design_cycle_count: Some(1000),
            temperature_c: Some(30.0),
            charge_percent: Some(80),
            is_charging: Some(false),
            external_power: Some(true),
            permanent_failure: Some(false),
            os_condition: Some("Good".into()),
            ..Default::default()
        }))
    }

    fn storage() -> Result<Vec<DiskInfo>, ProbeError> {
        Ok(vec![DiskInfo {
            id: "disk0".into(),
            model: Some("Test SSD".into()),
            size_bytes: Some(500_000_000_000),
            solid_state: Some(true),
            protocol: Some("PCI-Express".into()),
            internal: Some(true),
            smart_status: Some("Verified".into()),
            trim: Some(true),
            system_volume: Some(VolumeSpace {
                free_bytes: 200_000_000_000,
                total_bytes: 500_000_000_000,
            }),
        }])
    }

    fn memory() -> Result<MemoryInfo, ProbeError> {
        Ok(MemoryInfo {
            total_bytes: Some(16 * GIB),
            app_bytes: Some(4 * GIB),
            wired_bytes: Some(2 * GIB),
            compressed_bytes: Some(GIB),
            swap_used_bytes: Some(0),
            swap_total_bytes: Some(0),
            pressure: Some(MemoryPressure::Normal),
            memory_type: Some("LPDDR4X".into()),
            modules: vec![MemoryModule {
                slot: Some("BANK 0".into()),
                size: Some("16 GB".into()),
                kind: Some("LPDDR4X".into()),
                speed: Some("3733 MHz".into()),
                status: Some("ok".into()),
            }],
            upgradeable: Some(false),
        })
    }

    fn cpu() -> Result<CpuInfo, ProbeError> {
        Ok(CpuInfo {
            model: Some("Test CPU".into()),
            physical_cores: Some(4),
            logical_cores: Some(8),
            performance_cores: None,
            efficiency_cores: None,
            base_frequency_hz: Some(2_000_000_000),
            load_percent: Some(10.0),
            thermal: Some(ThermalStatus {
                speed_limit_percent: Some(100),
                scheduler_limit_percent: Some(100),
                available_cpus: Some(8),
                thermal_warning_recorded: Some(false),
                performance_warning_recorded: Some(false),
            }),
        })
    }

    fn sensors() -> Result<SensorReadings, ProbeError> {
        let t = |key: &str, kind, celsius| TemperatureReading {
            key: key.into(),
            kind,
            celsius,
        };
        Ok(SensorReadings {
            temperatures: vec![
                t("TC0P", SensorKind::Cpu, 50.0),
                t("TG0P", SensorKind::Gpu, 45.0),
                t("TB0T", SensorKind::Battery, 30.0),
            ],
            fans: Some(vec![FanReading {
                index: 0,
                actual_rpm: Some(1800.0),
                min_rpm: Some(1200.0),
                max_rpm: Some(6000.0),
            }]),
        })
    }

    fn gpu() -> Result<Vec<GpuInfo>, ProbeError> {
        Ok(vec![GpuInfo {
            model: Some("Test GPU".into()),
            vendor: Some("Intel".into()),
            integrated: Some(true),
            graphics_api: Some("Metal 3".into()),
            ..Default::default()
        }])
    }

    fn ownership() -> Result<OwnershipInfo, ProbeError> {
        Ok(OwnershipInfo {
            activation_lock_enabled: Some(false),
            provisioning_enrolled: Some(false),
            mdm_enrolled: Some(false),
        })
    }

    fn serial_number() -> Result<Option<String>, ProbeError> {
        Ok(Some("TEST-SERIAL".into()))
    }

    fn wifi() -> Result<Option<WifiStatus>, ProbeError> {
        Ok(Some(WifiStatus {
            interface_name: Some("en0".into()),
            power_on: Some(true),
            service_active: Some(true),
            rssi_dbm: Some(-55),
            noise_dbm: Some(-90),
            transmit_rate_mbps: Some(866.0),
            phy_mode: Some(WifiPhyMode::Ac),
            channel: Some(WifiChannel {
                number: Some(36),
                band: WifiBand::Ghz5,
                width_mhz: Some(80),
            }),
            interface_mode: Some(WifiInterfaceMode::Station),
        }))
    }

    fn network_route() -> Result<NetworkRoute, ProbeError> {
        Ok(NetworkRoute {
            interfaces: vec!["en0".into()],
            ipv4_reachable: Some(true),
            ipv6_reachable: Some(false),
        })
    }

    fn bluetooth() -> Result<BluetoothInfo, ProbeError> {
        Ok(BluetoothInfo {
            controller_present: true,
            powered: Some(true),
            discoverable: Some(false),
            chipset: Some("TEST_CHIP".into()),
            firmware: Some("v1".into()),
            transport: Some("UART".into()),
            vendor_id: Some("0x004C (Apple)".into()),
            services: vec!["A2DP".into(), "HID".into()],
            connected_types: vec![Some("Headphones".into()), None],
            paired_not_connected: 2,
        })
    }

    fn ports() -> Result<PortsInfo, ProbeError> {
        Ok(PortsInfo {
            thunderbolt: Some(vec![ThunderboltBus {
                index: Some(0),
                receptacles: vec![
                    ThunderboltReceptacle {
                        id: Some(1),
                        status: ReceptacleStatus::Empty,
                        speed_gbps: Some(40.0),
                        speed_is_max: true,
                        link_status: Some("0x101".into()),
                    },
                    ThunderboltReceptacle {
                        id: Some(2),
                        status: ReceptacleStatus::Connected,
                        speed_gbps: Some(20.0),
                        speed_is_max: false,
                        link_status: None,
                    },
                ],
                connected_devices: 0,
            }]),
            usb: Some(vec![
                UsbController {
                    usb_version: Some("3.1".into()),
                    built_in: Some(true),
                    apple_internal: false,
                    location_id: Some("0x0d000000".into()),
                    devices: vec![UsbDevice {
                        built_in: Some(false),
                        link_speed: Some("5 Gb/s".into()),
                        power: Some("4.5 W (900 mA)".into()),
                        vendor_id: Some("0x1234".into()),
                        location_id: Some("0x0d100000".into()),
                    }],
                },
                UsbController {
                    usb_version: None,
                    built_in: Some(true),
                    apple_internal: true,
                    location_id: Some("0x80000000".into()),
                    devices: vec![UsbDevice {
                        built_in: Some(true),
                        link_speed: Some("480 Mb/s".into()),
                        power: None,
                        vendor_id: Some("0x05ac".into()),
                        location_id: Some("0x80100000".into()),
                    }],
                },
            ]),
        })
    }

    fn audio_devices() -> Result<Vec<AudioDevice>, ProbeError> {
        Ok(vec![
            AudioDevice {
                builtin_name: Some("Speaker Uji".into()),
                transport: AudioTransport::BuiltIn,
                output_channels: Some(2),
                input_channels: None,
                default_output: true,
                default_input: false,
                default_system_output: true,
            },
            AudioDevice {
                builtin_name: None,
                transport: AudioTransport::Virtual,
                output_channels: Some(2),
                input_channels: Some(2),
                default_output: false,
                default_input: false,
                default_system_output: false,
            },
        ])
    }

    fn touch_bar() -> Result<TouchBarEvidence, ProbeError> {
        Ok(TouchBarEvidence {
            display_device: Some(true),
            backlight_device: Some(true),
            server_running: Some(true),
        })
    }

    fn sources(_check: CheckId) -> &'static [&'static str] {
        &["sumber uji"]
    }

    fn notes(_check: CheckId) -> &'static [super::Note] {
        &[("note.test", "catatan uji")]
    }

    fn support() -> PlatformSupport {
        PlatformSupport::new(SupportLevel::Verified, "uji".into())
    }
}

/// Semua pembacaan gagal.
pub struct Failing;

fn fail<T>() -> Result<T, ProbeError> {
    Err(ProbeError::new("gagal (uji)"))
}

impl Platform for Failing {
    fn system_overview() -> Result<SystemOverview, ProbeError> {
        fail()
    }
    fn battery() -> Result<Option<BatteryInfo>, ProbeError> {
        fail()
    }
    fn storage() -> Result<Vec<DiskInfo>, ProbeError> {
        fail()
    }
    fn memory() -> Result<MemoryInfo, ProbeError> {
        fail()
    }
    fn cpu() -> Result<CpuInfo, ProbeError> {
        fail()
    }
    fn sensors() -> Result<SensorReadings, ProbeError> {
        fail()
    }
    fn gpu() -> Result<Vec<GpuInfo>, ProbeError> {
        fail()
    }
    fn ownership() -> Result<OwnershipInfo, ProbeError> {
        fail()
    }
    fn serial_number() -> Result<Option<String>, ProbeError> {
        fail()
    }
    fn wifi() -> Result<Option<WifiStatus>, ProbeError> {
        fail()
    }
    fn network_route() -> Result<NetworkRoute, ProbeError> {
        fail()
    }
    fn bluetooth() -> Result<BluetoothInfo, ProbeError> {
        fail()
    }
    fn ports() -> Result<PortsInfo, ProbeError> {
        fail()
    }
    fn audio_devices() -> Result<Vec<AudioDevice>, ProbeError> {
        fail()
    }
    fn touch_bar() -> Result<TouchBarEvidence, ProbeError> {
        fail()
    }
    fn sources(_check: CheckId) -> &'static [&'static str] {
        &[]
    }
    fn notes(_check: CheckId) -> &'static [super::Note] {
        &[]
    }
    fn support() -> PlatformSupport {
        PlatformSupport::new(SupportLevel::Preview, "uji".into())
    }
}
