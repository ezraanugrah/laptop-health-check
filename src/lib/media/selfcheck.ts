// Pemeriksaan izin media dari JENDELA UTAMA (alat verifikasi Fase 3.0, lihat
// src-tauri/src/selfcheck.rs). Kamera/mikrofon hanya diminta di jendela tes
// media terpisah. Laporan hanya berisi jumlah/status — tanpa label/ID perangkat.
import { api } from "../api.ts";
import type { Params, UiKey } from "../../i18n/translate.ts";
import type { LaunchMode, MediaKind, MediaPurpose, MediaSessionFinished } from "../../types/interactive";
import { mediaDevicesLocked, webGetUserMedia } from "./browser.ts";
import { securityViolations, type SessionReportLike } from "./evaluate.ts";
import { activeSessionCount } from "./session.ts";
import {
  MAIN_PROBE_KEY,
  MEDIA_PROBE_KEY,
  kindsOf,
  randomToken,
  requestExpectingDenial,
  type Denial,
} from "./window-session.ts";

/** Batas menunggu jendela media melapor (termasuk menunggu dialog macOS). */
const WINDOW_WAIT_MS = 180_000;

type Gum = (c: MediaStreamConstraints) => Promise<MediaStream>;

export interface MainHooks {
  /** Baris log sebagai kunci terjemahan + parameter (diterjemahkan halaman). */
  log: (key: UiKey, params?: Params) => void;
  /** Jendela tes media sedang terbuka (untuk tombol "Batalkan" di jendela utama). */
  onWindowOpen?: (open: boolean) => void;
}

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

/** Membuka jendela tes media dan menunggu laporannya (atau penutupannya). */
async function runInMediaWindow(
  kind: MediaKind,
  purpose: MediaPurpose,
  holdMs: number,
  hooks: MainHooks,
  cancelAfterMs?: number,
): Promise<MediaSessionFinished & { waitTimedOut?: boolean }> {
  let resolveFinished!: (p: MediaSessionFinished) => void;
  const finished = new Promise<MediaSessionFinished>((r) => {
    resolveFinished = r;
  });
  const unlisten = await api.onMediaSessionFinished((p) => resolveFinished(p));
  try {
    await api.openMediaWindow(kind, purpose, holdMs);
    hooks.onWindowOpen?.(true);
    if (cancelAfterMs !== undefined) {
      window.setTimeout(() => void api.cancelMediaWindow(), cancelAfterMs);
    }
    const timedOut = sleep(WINDOW_WAIT_MS).then(() => "timeout" as const);
    const outcome = await Promise.race([finished, timedOut]);
    if (outcome === "timeout") {
      await api.cancelMediaWindow();
      return { task: null, report: null, closedByUser: false, waitTimedOut: true };
    }
    return outcome;
  } finally {
    unlisten();
    hooks.onWindowOpen?.(false);
  }
}

async function permissionState(name: string): Promise<string> {
  try {
    const status = await navigator.permissions.query({ name } as unknown as PermissionDescriptor);
    return status.state;
  } catch {
    return "tidak didukung";
  }
}

async function deviceCounts() {
  const md = navigator.mediaDevices;
  if (!md || typeof md.enumerateDevices !== "function") return null;
  try {
    const devices = await md.enumerateDevices();
    return {
      videoinput: devices.filter((d) => d.kind === "videoinput").length,
      audioinput: devices.filter((d) => d.kind === "audioinput").length,
      labelsHidden: devices.every((d) => d.label === ""),
    };
  } catch (e) {
    return { error: String((e as { name?: string }).name ?? e) };
  }
}

/** Jendela utama mencoba membuka gerbang — HARUS ditolak. */
async function mainTriesGate() {
  try {
    await api.mediaGateOpen(true, false);
    await api.mediaGateClose();
    return { allowed: true };
  } catch (e) {
    return { allowed: false, error: String(e) };
  }
}

function asSession(p: MediaSessionFinished | null): SessionReportLike | null {
  return (p?.report as SessionReportLike | null) ?? null;
}

export async function runMediaSelfcheck(mode: LaunchMode, hooks: MainHooks) {
  const started = performance.now();
  hooks.log("selfcheck.log.environment");
  const environment = {
    protocol: location.protocol,
    secureContext: window.isSecureContext,
    getUserMedia: webGetUserMedia() !== null,
    globalLocked: mediaDevicesLocked(),
  };
  const permissions = { camera: await permissionState("camera"), microphone: await permissionState("microphone") };
  const devices = await deviceCounts();
  const gateBefore = await api.mediaGateStatus();
  const mainGateOpenAttempt = await mainTriesGate();
  localStorage.setItem(MAIN_PROBE_KEY, randomToken());

  const details: Record<string, unknown> = {};
  let violations: UiKey[] = [];

  if (mode === "mediaDeny") {
    hooks.log("selfcheck.log.denyFromMain");
    const md = navigator.mediaDevices as unknown as { getUserMedia?: Gum } | undefined;
    details.globalApiLocked = await requestExpectingDenial(md?.getUserMedia ? (c) => md.getUserMedia!(c) : null, {
      camera: true,
      microphone: true,
    });
    await sleep(2_000);
    const deny: Record<string, Denial> = {
      camera: await requestExpectingDenial(webGetUserMedia(), { camera: true, microphone: false }),
      microphone: await requestExpectingDenial(webGetUserMedia(), { camera: false, microphone: true }),
    };
    details.denyFromMain = deny;
    violations = Object.values(deny)
      .filter((d) => d.result === "resolved")
      .map((): UiKey => "violation.denyFromMain");
    if ((details.globalApiLocked as Denial).result === "resolved") violations.push("violation.globalNotLocked");
  }

  if (mode === "mediaIsolation") {
    hooks.log("selfcheck.log.isolation1");
    const first = await runInMediaWindow("camera", "dryRun", 2_000, hooks);
    const firstGone = !(await api.mediaWindowOpen());
    hooks.log("selfcheck.log.isolation2");
    const second = await runInMediaWindow("camera", "dryRun", 1_500, hooks);
    hooks.log("selfcheck.log.isolation3");
    const cancelled = await runInMediaWindow("camera", "dryRun", 10_000, hooks, 1_500);
    details.isolation = { first, firstGone, second, cancelled };
    const r1 = first.report as { stop?: { reason: string }; gateOpenAttempt?: { allowed: boolean } } | null;
    const r2 = second.report as { gateOpenAttempt?: { allowed: boolean } } | null;
    violations = securityViolations({
      session: asSession(first),
      gateAfter: await api.mediaGateStatus(),
      mediaWindowStillOpen: await api.mediaWindowOpen(),
      retryFromFreshWindow: { ...(asSession(second) ?? {}), gateOpenAttempt: r2?.gateOpenAttempt },
      mainGateOpenAllowed: mainGateOpenAttempt.allowed,
      mainSawMediaProbe: localStorage.getItem(MEDIA_PROBE_KEY) !== null,
    });
    if (r1?.gateOpenAttempt?.allowed) violations.push("violation.dryRunGateOpen");
    if (!firstGone) violations.push("violation.firstNotDestroyed");
    if (r1?.stop?.reason !== "timeout") violations.push("violation.timeoutBroken");
    if (!cancelled.closedByUser) violations.push("violation.cancelNotRecorded");
  }

  if (mode === "mediaDryRun") {
    hooks.log("selfcheck.log.dryRun");
    const dry = await runInMediaWindow("camera", "dryRun", 10_000, hooks);
    details.dryRun = dry;
    const stop = (dry.report as { stop?: { reason: string; how?: string } } | null)?.stop;
    details.stopButtonVerified = stop?.reason === "user";
    violations = securityViolations({
      session: asSession(dry),
      closedByUser: dry.closedByUser,
      gateAfter: await api.mediaGateStatus(),
      mediaWindowStillOpen: await api.mediaWindowOpen(),
      mainGateOpenAllowed: mainGateOpenAttempt.allowed,
    });
  }

  if (mode === "mediaCamera" || mode === "mediaMicrophone") {
    const kind: MediaKind = mode === "mediaCamera" ? "camera" : "microphone";
    const kinds = kindsOf({ kind });
    hooks.log("selfcheck.log.openSession");
    const session = await runInMediaWindow(kind, "session", 10_000, hooks);
    const gateAfterSession = await api.mediaGateStatus();
    const windowStillOpen = await api.mediaWindowOpen();
    await sleep(1_000);
    hooks.log("selfcheck.log.retryMain");
    const retryFromMain = await requestExpectingDenial(webGetUserMedia(), kinds);
    hooks.log("selfcheck.log.retryFresh");
    const fresh = await runInMediaWindow(kind, "retryClosed", 3_000, hooks);
    details.session = session;
    details.retryFromMain = retryFromMain;
    details.retryFromFreshWindow = fresh;
    details.gateAfterSession = gateAfterSession;
    const freshReport = fresh.report as (SessionReportLike & { request?: Denial }) | null;
    violations = securityViolations({
      session: asSession(session),
      closedByUser: session.closedByUser,
      gateAfter: await api.mediaGateStatus(),
      mediaWindowStillOpen: windowStillOpen || (await api.mediaWindowOpen()),
      retryFromMain,
      retryFromFreshWindow: freshReport ?? undefined,
      mainGateOpenAllowed: mainGateOpenAttempt.allowed,
      mainSawMediaProbe: localStorage.getItem(MEDIA_PROBE_KEY) !== null,
    });
  }

  localStorage.removeItem(MAIN_PROBE_KEY);
  const report = {
    mode,
    environment,
    permissions,
    devices,
    gateBefore,
    mainGateOpenAttempt,
    ...details,
    gateAfter: await api.mediaGateStatus(),
    mediaWindowOpenAfter: await api.mediaWindowOpen(),
    activeSessionsAfter: activeSessionCount(),
    violations,
    securityFailure: violations.length > 0,
    durationMs: Math.round(performance.now() - started),
  };
  if (violations.length > 0) hooks.log("selfcheck.log.violations", { list: violations.map((v) => `@${v}`) });
  else hooks.log("selfcheck.log.clean");
  return report;
}
