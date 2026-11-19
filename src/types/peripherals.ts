// CERMIN tipe Rust `src-tauri/src/peripherals.rs` + struct periferal di
// `src-tauri/src/diagnostics/raw.rs`. Wajib diperbarui bila tipe Rust berubah.
// Privasi: tidak ada field SSID/BSSID, alamat MAC/BD/IP, nomor seri, UID, atau
// nama perangkat Bluetooth/USB — data itu dibuang di backend.

// --- Wi-Fi ---------------------------------------------------------------------

export type WifiState = "noInterface" | "poweredOff" | "notConnected" | "connected" | "unknown";
export type WifiPhyMode = "none" | "11a" | "11b" | "11g" | "11n" | "11ac" | "11ax" | "11be" | "unknown";
export type WifiBand = "2.4GHz" | "5GHz" | "6GHz" | "unknown";
export type WifiInterfaceMode = "none" | "station" | "ibss" | "hostAp" | "unknown";
/** macOS melaporkan rute jaringan (`scutil --nwi`) — BUKAN uji internet. */
export type RouteState = "reported" | "notReported" | "unknown";
/** Uji internet aktif tidak diimplementasikan (aturan offline). */
export type InternetTest = "awaitingOwnerDecision";

export interface RouteReport {
  state: RouteState;
  interfaceCount: number;
  wifiInterfaceListed: boolean | null;
  ipv4: boolean | null;
  ipv6: boolean | null;
  error: string | null;
}

export interface WifiReport {
  state: WifiState;
  /** Nama antarmuka BSD, mis. "en0". */
  interfaceName: string | null;
  powerOn: boolean | null;
  serviceActive: boolean | null;
  rssiDbm: number | null;
  noiseDbm: number | null;
  snrDb: number | null;
  transmitRateMbps: number | null;
  phyMode: WifiPhyMode | null;
  channelNumber: number | null;
  channelBand: WifiBand | null;
  channelWidthMhz: number | null;
  interfaceMode: WifiInterfaceMode | null;
  /** Kendala teknis pembacaan (tidak diterjemahkan). */
  error: string | null;
  route: RouteReport;
  internetTest: InternetTest;
}

// --- Bluetooth -----------------------------------------------------------------

export type BluetoothState = "noController" | "on" | "off" | "unknown";

export interface BluetoothReport {
  state: BluetoothState;
  chipset: string | null;
  firmware: string | null;
  transport: string | null;
  vendorId: string | null;
  discoverable: boolean | null;
  services: string[];
  connectedCount: number;
  /** Jenis perangkat tersambung saja (mis. "Headphones"); `null` = tidak dilaporkan. */
  connectedTypes: (string | null)[];
  pairedNotConnected: number;
  error: string | null;
}

// --- Port USB/Thunderbolt --------------------------------------------------------

/** "empty" = kosong, BUKAN rusak. */
export type ReceptacleStatus = "empty" | "connected" | "unknown";

export interface ThunderboltReceptacle {
  id: number | null;
  status: ReceptacleStatus;
  speedGbps: number | null;
  /** `true` = "Up to …" (kemampuan port, bukan tautan aktif). */
  speedIsMax: boolean;
  linkStatus: string | null;
}

export interface ThunderboltBus {
  index: number | null;
  receptacles: ThunderboltReceptacle[];
  connectedDevices: number;
}

export interface UsbDevice {
  /** `true` = komponen bawaan, `false` = eksternal, `null` = tidak diketahui. */
  builtIn: boolean | null;
  linkSpeed: string | null;
  power: string | null;
  vendorId: string | null;
  locationId: string | null;
}

export interface UsbController {
  usbVersion: string | null;
  builtIn: boolean | null;
  /** Bus internal Apple (T2): komponen bawaan, bukan port fisik. */
  appleInternal: boolean;
  locationId: string | null;
  devices: UsbDevice[];
}

export interface PortsSnapshot {
  thunderbolt: ThunderboltBus[];
  usb: UsbController[];
  thunderboltAvailable: boolean;
  usbAvailable: boolean;
  receptacleCount: number;
  externalUsbDevices: number;
  error: string | null;
}

// --- Audio (untuk Tes Speaker) ---------------------------------------------------

export type AudioTransport =
  | "builtIn"
  | "bluetooth"
  | "usb"
  | "hdmi"
  | "displayPort"
  | "airPlay"
  | "virtual"
  | "unknown";

export interface AudioDevice {
  /** Hanya untuk perangkat bawaan Apple (mis. "MacBook Pro Speakers"); lainnya `null`. */
  builtinName: string | null;
  transport: AudioTransport;
  outputChannels: number | null;
  inputChannels: number | null;
  defaultOutput: boolean;
  defaultInput: boolean;
  defaultSystemOutput: boolean;
}

export interface AudioOutputs {
  defaultOutput: AudioDevice | null;
  /** `null` = tidak terbaca (BUKAN berarti tidak ada speaker). */
  builtinOutputPresent: boolean | null;
  builtinOutputNames: string[];
  outputs: AudioDevice[];
  error: string | null;
}

// --- Touch Bar -------------------------------------------------------------------

export type Presence = "present" | "absent" | "unknown";
export type TouchBarSignal = "usbDisplayDevice" | "usbBacklightDevice" | "touchBarServerRunning";

export interface TouchBarPresence {
  presence: Presence;
  evidence: TouchBarSignal[];
  /** Belum terverifikasi di hardware asli (Apple Silicon / hanya bukti proses): hanya informasi. */
  experimental: boolean;
  error: string | null;
}
