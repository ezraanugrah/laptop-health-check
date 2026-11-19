// Menghubungkan lib/media/session.ts ke WebView dan gerbang izin Rust.
//
// Temuan Fase 3.0 (macOS 26, build produksi): WebKit meminta izin TCC macOS
// (dialog sistem) SEBELUM menanyakan handler izin aplikasi. Gerbang Rust tetap
// menahan stream, tetapi tidak bisa mencegah dialog macOS muncul. Karena itu
// `getUserMedia`/`getDisplayMedia` global DIKUNCI sejak aplikasi dimuat
// (`lockMediaDevices`), dan fungsi aslinya hanya dipegang modul ini — dipakai
// lewat session.ts saat tes yang dimulai pengguna.
import { api } from "../api.ts";
import type { MediaDeps } from "./session.ts";

type GetUserMedia = (constraints: MediaStreamConstraints) => Promise<MediaStream>;

interface MediaDevicesLike {
  getUserMedia?: GetUserMedia;
  getDisplayMedia?: (options?: never) => Promise<MediaStream>;
}

export const LOCKED_MESSAGE = "Akses kamera/mikrofon hanya tersedia lewat tes yang dimulai pengguna.";

let original: GetUserMedia | null = null;
let locked = false;

function notAllowed(): Promise<never> {
  const error = Object.assign(new Error(LOCKED_MESSAGE), { name: "NotAllowedError" });
  return Promise.reject(error);
}

/**
 * Mengunci API capture global. Aman dipanggil berkali-kali.
 * `md` bisa disuntikkan untuk test; default `navigator.mediaDevices`.
 */
export function lockMediaDevices(md: MediaDevicesLike | undefined = globalThis.navigator?.mediaDevices): boolean {
  if (!md || locked) return locked;
  if (typeof md.getUserMedia === "function") {
    original = md.getUserMedia.bind(md);
  }
  for (const name of ["getUserMedia", "getDisplayMedia"] as const) {
    Object.defineProperty(md, name, { value: notAllowed, writable: false, configurable: false });
  }
  locked = true;
  return true;
}

export function mediaDevicesLocked(): boolean {
  return locked;
}

/** getUserMedia ASLI (sebelum dikunci), atau `null` bila WebView tidak menyediakannya. */
export function webGetUserMedia(): GetUserMedia | null {
  if (original) return original;
  if (locked) return null;
  const md = globalThis.navigator?.mediaDevices;
  if (!md || typeof md.getUserMedia !== "function") return null;
  return (c) => md.getUserMedia(c);
}

export function browserMediaDeps(): MediaDeps<MediaStream> {
  return {
    getUserMedia: webGetUserMedia(),
    openGate: (camera, microphone) => api.mediaGateOpen(camera, microphone),
    closeGate: () => api.mediaGateClose(),
    setTimer: (fn, ms) => window.setTimeout(fn, ms),
    clearTimer: (handle) => window.clearTimeout(handle as number),
  };
}
