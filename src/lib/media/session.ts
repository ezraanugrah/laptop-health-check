// Pengelolaan akses kamera/mikrofon (Fase 3.0).
//
// Aturan yang dijamin modul ini (dites di session.test.ts):
// 1. Gerbang izin di Rust dibuka HANYA tepat sebelum getUserMedia, dan ditutup
//    lagi segera setelah permintaan selesai (berhasil atau gagal). Setelah itu
//    halaman tidak bisa meminta akses baru tanpa membuka gerbang lagi.
// 2. Hanya jenis yang diminta (kamera dan/atau mikrofon) yang diminta.
// 3. release() menghentikan SEMUA track, idempoten, dan otomatis dipanggil
//    saat batas waktu sesi habis atau halaman ditutup/dimuat ulang.
// 4. Tidak ada perekaman ke file: modul ini hanya memberi MediaStream di memori.

export const MAX_SESSION_MS = 120_000;

export interface MediaKinds {
  camera: boolean;
  microphone: boolean;
}

/** Bentuk minimal MediaStreamTrack/MediaStream (agar bisa dites di Node). */
export interface TrackLike {
  readonly kind?: string;
  readonly readyState?: string;
  stop(): void;
}
export interface StreamLike {
  getTracks(): TrackLike[];
}

export interface MediaDeps<S extends StreamLike = StreamLike> {
  /** `null` bila WebView tidak menyediakan navigator.mediaDevices.getUserMedia. */
  getUserMedia: ((constraints: MediaStreamConstraints) => Promise<S>) | null;
  openGate: (camera: boolean, microphone: boolean) => Promise<unknown>;
  closeGate: () => Promise<unknown>;
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
}

export type MediaFailure = "unsupported" | "denied" | "notFound" | "busy" | "gate" | "other";

/** Kunci terjemahan alasan kegagalan (src/i18n/ui.ts). */
export const FAILURE_KEY = {
  unsupported: "mediaFailure.unsupported",
  denied: "mediaFailure.denied",
  notFound: "mediaFailure.notFound",
  busy: "mediaFailure.busy",
  gate: "mediaFailure.gate",
  other: "mediaFailure.other",
} as const satisfies Record<MediaFailure, string>;

export interface MediaSession<S extends StreamLike = StreamLike> {
  readonly stream: S;
  readonly released: boolean;
  release(reason?: string): Promise<void>;
}

export type AcquireResult<S extends StreamLike = StreamLike> =
  | { ok: true; session: MediaSession<S> }
  | { ok: false; failure: MediaFailure; errorName?: string };

const active = new Set<MediaSession>();

export function activeSessionCount(): number {
  return active.size;
}

export function classifyMediaError(error: unknown): { failure: MediaFailure; errorName?: string } {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name: unknown }).name)
      : undefined;
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return { failure: "denied", errorName: name };
    case "NotFoundError":
    case "OverconstrainedError":
      return { failure: "notFound", errorName: name };
    case "NotReadableError":
    case "AbortError":
      return { failure: "busy", errorName: name };
    case "TypeError":
      return { failure: "unsupported", errorName: name };
    default:
      return { failure: "other", errorName: name };
  }
}

/** Menyusun constraint hanya untuk jenis yang diminta. */
export function buildConstraints(
  kinds: MediaKinds,
  extra: { video?: MediaTrackConstraints; audio?: MediaTrackConstraints } = {},
): MediaStreamConstraints {
  return {
    video: kinds.camera ? (extra.video ?? true) : false,
    audio: kinds.microphone ? (extra.audio ?? true) : false,
  };
}

export async function acquireMedia<S extends StreamLike>(
  kinds: MediaKinds,
  deps: MediaDeps<S>,
  extra: { video?: MediaTrackConstraints; audio?: MediaTrackConstraints } = {},
  maxMs: number = MAX_SESSION_MS,
): Promise<AcquireResult<S>> {
  if (!kinds.camera && !kinds.microphone) return { ok: false, failure: "other" };
  if (!deps.getUserMedia) return { ok: false, failure: "unsupported" };

  try {
    await deps.openGate(kinds.camera, kinds.microphone);
  } catch {
    return { ok: false, failure: "gate" };
  }

  let stream: S;
  try {
    stream = await deps.getUserMedia(buildConstraints(kinds, extra));
  } catch (error) {
    await safeClose(deps);
    return { ok: false, ...classifyMediaError(error) };
  }
  // Izin sudah diputuskan; gerbang tidak dibutuhkan lagi selama sesi berjalan.
  await safeClose(deps);

  let released = false;
  let timer: unknown = null;
  const session: MediaSession<S> = {
    stream,
    get released() {
      return released;
    },
    async release() {
      if (released) return;
      released = true;
      if (timer !== null) deps.clearTimer(timer);
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Track yang sudah berhenti boleh melempar; tetap lanjut ke track lain.
        }
      }
      active.delete(session as MediaSession);
      await safeClose(deps);
    },
  };
  active.add(session as MediaSession);
  timer = deps.setTimer(() => void session.release("batas waktu sesi"), maxMs);
  return { ok: true, session };
}

/** Menghentikan semua sesi aktif (mis. saat pindah halaman atau jendela ditutup). */
export async function releaseAllMedia(reason = "semua sesi dihentikan"): Promise<void> {
  await Promise.all([...active].map((s) => s.release(reason)));
}

/**
 * Jaring pengaman: sesi dihentikan saat halaman disembunyikan/ditutup/dimuat
 * ulang. Mengembalikan fungsi untuk melepas listener.
 */
export function installMediaSafetyNet(target: EventTarget): () => void {
  const onLeave = () => void releaseAllMedia("halaman ditutup");
  target.addEventListener("pagehide", onLeave);
  target.addEventListener("beforeunload", onLeave);
  return () => {
    target.removeEventListener("pagehide", onLeave);
    target.removeEventListener("beforeunload", onLeave);
  };
}

/** Semua track sudah berhenti? (dipakai pemeriksaan izin dan tes). */
export function allTracksEnded(stream: StreamLike): boolean {
  return stream.getTracks().every((t) => t.readyState === "ended");
}

async function safeClose(deps: MediaDeps<StreamLike>): Promise<void> {
  try {
    await deps.closeGate();
  } catch {
    // Gerbang tetap menutup sendiri di Rust setelah batas waktu.
  }
}
