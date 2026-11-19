import { useEffect, useRef, useState } from "react";
import type { MediaTask } from "../types/interactive";
import { api } from "../lib/api";
import type { Hold } from "../lib/media/hold";
import { runMediaWindowTask } from "../lib/media/window-session";
import { useI18n } from "../lib/preferences";
import type { Params, UiKey } from "../i18n/translate";

const TITLE: Record<MediaTask["purpose"], UiKey> = {
  session: "mediaWindow.title.session",
  retryClosed: "mediaWindow.title.retryClosed",
  dryRun: "mediaWindow.title.dryRun",
};

/**
 * Isi JENDELA TES MEDIA: satu tugas, lalu jendela dihancurkan oleh backend.
 * Tidak menampilkan atau menyimpan gambar/suara.
 */
export function MediaWindowPage({ task }: { task: MediaTask }) {
  const { t } = useI18n();
  const dev: Params =
    task.kind === "camera"
      ? { device: "@device.camera", Device: "@device.Camera" }
      : { device: "@device.microphone", Device: "@device.Microphone" };
  const [lines, setLines] = useState<[UiKey, Params?][]>([]);
  const [hold, setHold] = useState<Hold | null>(null);
  const [remaining, setRemaining] = useState(0);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    runMediaWindowTask(task, {
      log: (key, params) => setLines((prev) => [...prev, [key, params]]),
      onActive: (h, maxMs) => {
        setHold(h);
        setRemaining(Math.ceil(maxMs / 1000));
      },
      onInactive: () => setHold(null),
    })
      .then((report) => api.finishMediaSession(report))
      .catch((e: unknown) => api.finishMediaSession({ purpose: task.purpose, error: String(e) }));
  }, [task]);

  // Hitung mundur + Esc sebagai jalan kedua untuk menghentikan.
  useEffect(() => {
    if (!hold) return;
    const tick = window.setInterval(() => setRemaining((s) => Math.max(0, s - 1)), 1000);
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        hold.stop("esc");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("keydown", onKey);
    };
  }, [hold]);

  return (
    <div className="space-y-3 p-5">
      <h1 className="text-lg font-semibold">{t(TITLE[task.purpose], dev)}</h1>
      <p className="text-xs text-slate-600 dark:text-slate-400">{t("mediaWindow.intro")}</p>
      {hold && (
        <div className="space-y-2 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          <p className="font-medium">
            {task.purpose === "dryRun"
              ? t("mediaWindow.activeDryRun", { n: remaining })
              : t("mediaWindow.active", { ...dev, n: remaining })}
          </p>
          <button
            type="button"
            onClick={() => hold.stop("tombol")}
            className="w-full rounded-md bg-rose-600 px-3 py-2 font-medium text-white hover:bg-rose-500"
          >
            {t("mediaWindow.stopNow")}
          </button>
          <p className="text-xs opacity-80">{t("mediaWindow.orEsc")}</p>
        </div>
      )}
      <ol className="space-y-1 font-mono text-[11px] text-slate-700 dark:text-slate-300">
        {lines.map(([key, params], i) => (
          <li key={i}>{t(key, params)}</li>
        ))}
      </ol>
    </div>
  );
}
