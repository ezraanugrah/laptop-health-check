// Evaluasi hasil pemeriksaan izin media (fungsi murni, dites di media.test.ts).
// Setiap pelanggaran menjadi alasan "kegagalan keamanan" yang menghentikan pengujian.
import type { UiKey } from "../../i18n/translate.ts";

export interface DenialLike {
  result: string;
}

export interface SessionReportLike {
  acquired?: boolean;
  allTracksEnded?: boolean;
  gateAfterRelease?: { open: boolean };
  activeSessionsAfterRelease?: number;
  gateOpenAttempt?: { allowed: boolean };
  probe?: { sawMainProbe: boolean; sawPreviousMediaProbe: boolean };
}

export interface IsolationInput {
  /** Laporan sesi (null bila jendela ditutup sebelum melapor). */
  session: SessionReportLike | null;
  closedByUser?: boolean;
  gateAfter: { open: boolean };
  mediaWindowStillOpen: boolean;
  /** Permintaan ulang dari jendela utama dengan gerbang tertutup. */
  retryFromMain?: DenialLike | null;
  /** Permintaan ulang dari jendela media BARU tanpa membuka gerbang. */
  retryFromFreshWindow?: SessionReportLike & { request?: DenialLike };
  /** Jendela utama mencoba membuka gerbang (harus ditolak). */
  mainGateOpenAllowed?: boolean;
  mainSawMediaProbe?: boolean;
}

/** Pelanggaran sebagai kunci terjemahan (bahasa-netral di laporan JSON). */
export function securityViolations(input: IsolationInput): UiKey[] {
  const v: UiKey[] = [];
  if (input.mainGateOpenAllowed) v.push("violation.mainGateOpen");
  if (input.gateAfter.open) v.push("violation.gateStillOpen");
  if (input.mediaWindowStillOpen) v.push("violation.windowNotDestroyed");
  const s = input.session;
  if (s) {
    if (s.acquired && s.allTracksEnded === false) v.push("violation.tracksLive");
    if (s.gateAfterRelease?.open) v.push("violation.gateOpenAfterRelease");
    if ((s.activeSessionsAfterRelease ?? 0) !== 0) v.push("violation.activeSessions");
    if (s.probe?.sawMainProbe) v.push("violation.sharedMainStorage");
    if (s.probe?.sawPreviousMediaProbe) v.push("violation.sharedPreviousStorage");
  }
  if (input.mainSawMediaProbe) v.push("violation.mainSawMedia");
  if (input.retryFromMain?.result === "resolved") {
    v.push("violation.retryMain");
  }
  const fresh = input.retryFromFreshWindow;
  if (fresh) {
    if (fresh.request?.result === "resolved") {
      v.push("violation.retryFresh");
    }
    if (fresh.gateOpenAttempt?.allowed) v.push("violation.retryGateOpen");
    if (fresh.probe?.sawMainProbe || fresh.probe?.sawPreviousMediaProbe) {
      v.push("violation.retryShared");
    }
  }
  return v;
}
