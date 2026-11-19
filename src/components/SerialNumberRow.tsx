import { useState } from "react";
import { api } from "../lib/api";

type State = "hidden" | "loading" | "shown" | "error";

/**
 * Nomor seri disembunyikan secara default dan baru dibaca dari perangkat
 * saat pengguna menekan "Tampilkan". Menyembunyikan kembali menghapus
 * nilainya dari memori komponen.
 */
export function SerialNumberRow() {
  const [state, setState] = useState<State>("hidden");
  const [serial, setSerial] = useState<string | null>(null);

  async function show() {
    setState("loading");
    try {
      setSerial(await api.getSerialNumber());
      setState("shown");
    } catch {
      setSerial(null);
      setState("error");
    }
  }

  function hide() {
    setSerial(null);
    setState("hidden");
  }

  const value =
    state === "shown"
      ? (serial ?? "Tidak dilaporkan oleh OS")
      : state === "error"
        ? "Tidak dapat dibaca"
        : "Disembunyikan";

  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
      <div className="min-w-0">
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Nomor seri</p>
        <p className="truncate font-mono text-xs" aria-live="polite">
          {value}
        </p>
      </div>
      {state === "shown" ? (
        <button
          type="button"
          onClick={hide}
          className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-white dark:border-slate-600 dark:hover:bg-slate-700"
        >
          Sembunyikan
        </button>
      ) : (
        <button
          type="button"
          onClick={show}
          disabled={state === "loading"}
          className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-white disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          {state === "loading" ? "Membaca…" : "Tampilkan"}
        </button>
      )}
    </div>
  );
}
