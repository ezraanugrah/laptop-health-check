// Penahan sesi media: berhenti oleh pengguna ("Hentikan sekarang"/Esc) ATAU
// oleh batas waktu otomatis — keduanya dibedakan dan dicatat.

export type StopReason = "user" | "timeout";

export interface HoldResult {
  reason: StopReason;
  /** Cara pengguna menghentikan (mis. "tombol", "esc"); hanya bila reason = user. */
  how?: string;
  heldMs: number;
}

export interface HoldTimers {
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  now: () => number;
}

export interface Hold {
  done: Promise<HoldResult>;
  /** Menghentikan lebih awal. Diabaikan bila sudah selesai. Mengembalikan true bila berpengaruh. */
  stop: (how: string) => boolean;
  readonly finished: boolean;
}

export function startHold(maxMs: number, timers: HoldTimers): Hold {
  const started = timers.now();
  let finished = false;
  let resolve!: (r: HoldResult) => void;
  const done = new Promise<HoldResult>((r) => {
    resolve = r;
  });
  const finish = (reason: StopReason, how?: string) => {
    if (finished) return false;
    finished = true;
    timers.clearTimer(handle);
    resolve({ reason, how, heldMs: Math.round(timers.now() - started) });
    return true;
  };
  const handle = timers.setTimer(() => finish("timeout"), maxMs);
  return {
    done,
    stop: (how) => finish("user", how),
    get finished() {
      return finished;
    },
  };
}
