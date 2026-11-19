// Logika di dalam JENDELA TES MEDIA (satu sesi, lalu jendela dihancurkan).
// Laporan hanya berisi status/jumlah — tidak pernah label/ID perangkat atau isi media.
import { api } from "../api.ts";
import type { Params, UiKey } from "../../i18n/translate.ts";
import type { MediaTask } from "../../types/interactive";
import { browserMediaDeps, webGetUserMedia } from "./browser.ts";
import { startHold, type Hold } from "./hold.ts";
import { acquireMedia, activeSessionCount, allTracksEnded, type MediaKinds } from "./session.ts";

/** Penanda acak untuk menguji apakah penyimpanan (data store) dibagi antarjendela. */
export const MAIN_PROBE_KEY = "lhc-isolation-probe-main";
export const MEDIA_PROBE_KEY = "lhc-isolation-probe-media";

const REQUEST_TIMEOUT_MS = 15_000;

export type Denial = { at: string } & (
  | { result: "rejected"; errorName: string }
  | { result: "resolved"; tracks: number; stoppedImmediately: true }
  | { result: "timeout" }
  | { result: "unsupported" }
);

type Gum = (c: MediaStreamConstraints) => Promise<MediaStream>;

export function kindsOf(task: Pick<MediaTask, "kind">): MediaKinds {
  return { camera: task.kind === "camera", microphone: task.kind === "microphone" };
}

export function randomToken(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Permintaan yang HARUS ditolak. Bila lolos, track langsung dihentikan. */
export async function requestExpectingDenial(gum: Gum | null, kinds: MediaKinds): Promise<Denial> {
  const at = new Date().toISOString();
  if (!gum) return { at, result: "unsupported" };
  const timeout = new Promise<Denial>((resolve) =>
    window.setTimeout(() => resolve({ at, result: "timeout" }), REQUEST_TIMEOUT_MS),
  );
  const attempt = gum({ video: kinds.camera, audio: kinds.microphone }).then(
    (stream): Denial => {
      stream.getTracks().forEach((t) => t.stop());
      return { at, result: "resolved", tracks: stream.getTracks().length, stoppedImmediately: true };
    },
    (e: unknown): Denial => ({
      at,
      result: "rejected",
      errorName: typeof e === "object" && e && "name" in e ? String(e.name) : "unknown",
    }),
  );
  return Promise.race([attempt, timeout]);
}

/** Mencoba membuka gerbang; untuk tugas selain Session ini HARUS ditolak Rust. */
async function tryOpenGate(kinds: MediaKinds): Promise<{ allowed: boolean; error?: string }> {
  try {
    await api.mediaGateOpen(kinds.camera, kinds.microphone);
    await api.mediaGateClose();
    return { allowed: true };
  } catch (e) {
    return { allowed: false, error: String(e) };
  }
}

function readAndWriteProbes() {
  const probe = {
    sawMainProbe: localStorage.getItem(MAIN_PROBE_KEY) !== null,
    sawPreviousMediaProbe: localStorage.getItem(MEDIA_PROBE_KEY) !== null,
  };
  localStorage.setItem(MEDIA_PROBE_KEY, randomToken());
  return probe;
}

export interface WindowHooks {
  /** Baris log sebagai kunci terjemahan + parameter (diterjemahkan halaman). */
  log: (key: UiKey, params?: Params) => void;
  /** Sesi aktif: tampilkan "Hentikan sekarang" yang memanggil `hold.stop`. */
  onActive: (hold: Hold, maxMs: number) => void;
  onInactive: () => void;
}

const browserTimers = {
  setTimer: (fn: () => void, ms: number) => window.setTimeout(fn, ms),
  clearTimer: (h: unknown) => window.clearTimeout(h as number),
  now: () => performance.now(),
};

async function holdWithUi(task: MediaTask, hooks: WindowHooks) {
  await api.focusMediaWindow().catch(() => undefined);
  const hold = startHold(task.holdMs, browserTimers);
  hooks.onActive(hold, task.holdMs);
  const stop = await hold.done;
  hooks.onInactive();
  return stop;
}

export async function runMediaWindowTask(task: MediaTask, hooks: WindowHooks) {
  const kinds = kindsOf(task);
  const dev: Params = task.kind === "camera"
    ? { Device: "@device.Camera", device: "@device.camera" }
    : { Device: "@device.Microphone", device: "@device.microphone" };
  const probe = readAndWriteProbes();

  if (task.purpose === "dryRun") {
    hooks.log("mediaLog.dryRun");
    const gateOpenAttempt = await tryOpenGate(kinds);
    const stop = await holdWithUi(task, hooks);
    if (stop.reason === "user") hooks.log("mediaLog.stoppedByUser", { how: `@stopHow.${stop.how}` });
    else hooks.log("mediaLog.stoppedTimeout");
    return { purpose: task.purpose, probe, gateOpenAttempt, stop, gateAfter: await api.mediaGateStatus() };
  }

  if (task.purpose === "retryClosed") {
    hooks.log("mediaLog.retryRequest", dev);
    const gateOpenAttempt = await tryOpenGate(kinds);
    const request = await requestExpectingDenial(webGetUserMedia(), kinds);
    hooks.log("mediaLog.retryResult", { ...dev, result: request.result });
    return { purpose: task.purpose, probe, gateOpenAttempt, request, gateAfter: await api.mediaGateStatus() };
  }

  // Sesi tes nyata.
  hooks.log("mediaLog.sessionRequest", dev);
  const requestedAt = new Date().toISOString();
  const acquired = await acquireMedia(kinds, browserMediaDeps(), {}, task.holdMs + 5_000);
  const gateRightAfter = await api.mediaGateStatus();
  if (!acquired.ok) {
    hooks.log("mediaLog.notGranted", { ...dev, failure: acquired.failure });
    return { purpose: task.purpose, probe, requestedAt, acquired: false, failure: acquired.failure, errorName: acquired.errorName, gateRightAfter };
  }
  const tracks = acquired.session.stream.getTracks().map((t) => {
    const s = t.getSettings();
    return {
      kind: t.kind,
      readyState: t.readyState,
      width: s.width ?? null,
      height: s.height ?? null,
      frameRate: s.frameRate ? Math.round(s.frameRate) : null,
      sampleRate: s.sampleRate ?? null,
      channelCount: s.channelCount ?? null,
    };
  });
  const activeAt = new Date().toISOString();
  hooks.log("mediaLog.active", dev);
  const stop = await holdWithUi(task, hooks);
  await acquired.session.release(stop.reason === "user" ? "dihentikan pengguna" : "batas waktu");
  const releasedAt = new Date().toISOString();
  const result = {
    purpose: task.purpose,
    probe,
    requestedAt,
    acquired: true,
    tracks,
    activeAt,
    stop,
    releasedAt,
    allTracksEnded: allTracksEnded(acquired.session.stream),
    gateRightAfter,
    gateAfterRelease: await api.mediaGateStatus(),
    activeSessionsAfterRelease: activeSessionCount(),
  };
  hooks.log("mediaLog.stopped", {
    ...dev,
    how: stop.reason === "user" ? "@mediaLog.byYou" : "@mediaLog.automatically",
    tracks: result.allTracksEnded ? "@mediaLog.tracksStopped" : "@mediaLog.tracksLive",
  });
  return result;
}
