// Satu sesi tes kamera/mikrofon PENGGUNA dari jendela utama: membuka jendela tes media
// terpisah (Rust memvalidasi asal & tugas; jendela utama tidak pernah bisa memakai media)
// lalu menunggu laporannya. File ini tidak memanggil API capture apa pun.
import { api } from "../api.ts";
import type { MediaKind, MediaSessionFinished } from "../../types/interactive";

export type UserSessionOutcome =
  | { kind: "finished"; payload: MediaSessionFinished }
  | { kind: "timeout" }
  | { kind: "error"; error: string };

export async function runUserMediaSession(kind: MediaKind, holdMs: number, waitMs: number): Promise<UserSessionOutcome> {
  let resolveFinished!: (p: MediaSessionFinished) => void;
  const finished = new Promise<MediaSessionFinished>((r) => {
    resolveFinished = r;
  });
  const unlisten = await api.onMediaSessionFinished((p) => resolveFinished(p));
  let timer: number | undefined;
  try {
    try {
      await api.openMediaWindow(kind, "session", holdMs);
    } catch (e) {
      return { kind: "error", error: String(e) };
    }
    const timeout = new Promise<"timeout">((r) => {
      timer = window.setTimeout(() => r("timeout"), waitMs);
    });
    const outcome = await Promise.race([finished, timeout]);
    if (outcome === "timeout") {
      await api.cancelMediaWindow().catch(() => undefined);
      return { kind: "timeout" };
    }
    return { kind: "finished", payload: outcome };
  } finally {
    window.clearTimeout(timer);
    unlisten();
  }
}
