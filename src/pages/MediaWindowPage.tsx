import { useEffect, useRef, useState } from "react";
import type { MediaTask } from "../types/interactive";
import { api } from "../lib/api";
import type { Hold } from "../lib/media/hold";
import { runMediaWindowTask, type WindowHooks } from "../lib/media/window-session";
import { meterSegments, rmsToDbfs } from "../lib/interactive/media-tests";
import { useI18n } from "../lib/preferences";
import type { Params, UiKey } from "../i18n/translate";

const TITLE: Record<MediaTask["purpose"], UiKey> = {
  session: "mediaWindow.title.session",
  retryClosed: "mediaWindow.title.retryClosed",
  dryRun: "mediaWindow.title.dryRun",
};

type VideoWithFrames = HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };

interface Playback {
  url: string | null;
  played: () => void;
  done: () => void;
}

const METER = Array.from({ length: 20 }, (_, i) => i);

/**
 * Isi JENDELA TES MEDIA: satu tugas, lalu jendela dihancurkan oleh backend.
 * Self-check: tidak menampilkan atau menyimpan gambar/suara.
 * Tes pengguna (mode normal): pratinjau kamera / meter level + rekaman SEMENTARA di memori
 * yang diputar ulang setelah mikrofon dimatikan, lalu dibuang. Tidak ada yang ditulis ke disk.
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
  // Tes pengguna hanya pada mode normal; mode self-check tetap tanpa pratinjau/rekaman.
  const [interactive, setInteractive] = useState<boolean | null>(null);
  const videoRef = useRef<VideoWithFrames>(null);
  const frames = useRef(0);
  const frameSupported = useRef(false);
  const [previewOn, setPreviewOn] = useState(false);
  const [level, setLevel] = useState(-100);
  const peak = useRef(-100);
  const meterTimer = useRef<number | undefined>(undefined);
  const audioCtx = useRef<AudioContext | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recStart = useRef(0);
  const [playback, setPlayback] = useState<Playback | null>(null);

  useEffect(() => {
    api
      .getLaunchMode()
      .then((m) => setInteractive(m === "normal"))
      .catch(() => setInteractive(false));
  }, []);

  useEffect(() => {
    if (interactive === null || ran.current) return;
    ran.current = true;
    const hooks: WindowHooks = {
      log: (key, params) => setLines((prev) => [...prev, [key, params]]),
      onActive: (h, maxMs) => {
        setHold(h);
        setRemaining(Math.ceil(maxMs / 1000));
      },
      onInactive: () => setHold(null),
    };
    if (interactive && task.purpose === "session" && task.kind === "camera") {
      hooks.onStream = (stream) => {
        const v = videoRef.current;
        if (!v) return;
        setPreviewOn(true);
        v.srcObject = stream;
        void v.play().catch(() => undefined);
        if (typeof v.requestVideoFrameCallback === "function") {
          frameSupported.current = true;
          const onFrame = () => {
            frames.current += 1;
            if (v.srcObject) v.requestVideoFrameCallback?.(onFrame);
          };
          v.requestVideoFrameCallback(onFrame);
        }
      };
      hooks.collect = () => {
        const v = videoRef.current;
        const info = {
          framesRendered: frameSupported.current ? frames.current : null,
          frameCountSupported: frameSupported.current,
        };
        if (v) {
          v.pause();
          v.srcObject = null;
        }
        setPreviewOn(false);
        return info;
      };
    }
    if (interactive && task.purpose === "session" && task.kind === "microphone") {
      hooks.onStream = (stream) => {
        try {
          const ctx = new AudioContext();
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 2048;
          ctx.createMediaStreamSource(stream).connect(analyser); // tidak ke speaker
          const buf = new Float32Array(analyser.fftSize);
          meterTimer.current = window.setInterval(() => {
            analyser.getFloatTimeDomainData(buf);
            let sum = 0;
            for (const x of buf) sum += x * x;
            const db = rmsToDbfs(Math.sqrt(sum / buf.length));
            peak.current = Math.max(peak.current, db);
            setLevel(db);
          }, 100);
          audioCtx.current = ctx;
        } catch {
          // Meter level opsional.
        }
        if (typeof MediaRecorder !== "undefined") {
          try {
            const r = new MediaRecorder(stream);
            r.ondataavailable = (e) => {
              if (e.data.size > 0) chunks.current.push(e.data);
            };
            r.start();
            recStart.current = performance.now();
            recorder.current = r;
          } catch {
            recorder.current = null;
          }
        }
      };
      hooks.collect = () => {
        window.clearInterval(meterTimer.current);
        void audioCtx.current?.close().catch(() => undefined);
        audioCtx.current = null;
        return {
          peakDbfs: peak.current > -100 ? peak.current : null,
          recordedMs: recStart.current ? Math.round(performance.now() - recStart.current) : null,
          recorderSupported: recorder.current !== null,
        };
      };
      // Mikrofon SUDAH mati di sini; hanya memutar ulang dari memori, lalu dibuang.
      hooks.afterRelease = () =>
        new Promise((resolve) => {
          let played = false;
          const show = () => {
            const blob = chunks.current.length > 0 ? new Blob(chunks.current, { type: chunks.current[0].type }) : null;
            const url = blob ? URL.createObjectURL(blob) : null;
            setPlayback({
              url,
              played: () => {
                played = true;
              },
              done: () => {
                if (url) URL.revokeObjectURL(url);
                chunks.current = [];
                recorder.current = null;
                setPlayback(null);
                resolve({ played });
              },
            });
          };
          const r = recorder.current;
          if (r && r.state !== "inactive") {
            r.onstop = show;
            try {
              r.stop();
            } catch {
              show();
            }
          } else {
            show();
          }
        });
    }
    runMediaWindowTask(task, hooks)
      .then((report) => api.finishMediaSession(report))
      .catch((e: unknown) => api.finishMediaSession({ purpose: task.purpose, error: String(e) }));
  }, [task, interactive]);

  // Pengaman: sumber daya audio/video dilepas bila jendela ditutup.
  useEffect(
    () => () => {
      window.clearInterval(meterTimer.current);
      void audioCtx.current?.close().catch(() => undefined);
      chunks.current = [];
    },
    [],
  );

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
      {interactive && task.kind === "camera" && (
        <video
          ref={videoRef}
          aria-label={t("camera.window.previewLabel")}
          muted
          playsInline
          className={previewOn ? "aspect-video w-full rounded-md bg-black" : "hidden"}
        />
      )}
      {interactive && task.kind === "microphone" && hold && (
        <div className="space-y-1">
          <p className="text-xs font-medium">{t("microphone.window.recording")}</p>
          <div className="flex gap-0.5" role="meter" aria-label={t("microphone.window.level")} aria-valuemin={-60} aria-valuemax={0} aria-valuenow={Math.round(Math.max(-60, level))}>
            {METER.map((i) => (
              <span
                key={i}
                className={`h-3 flex-1 rounded-sm ${
                  i < meterSegments(level) ? (i >= 16 ? "bg-rose-500" : i >= 12 ? "bg-amber-500" : "bg-emerald-500") : "bg-slate-200 dark:bg-slate-700"
                }`}
              />
            ))}
          </div>
        </div>
      )}
      {playback && (
        <div className="space-y-2 rounded-lg border border-slate-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
          {playback.url ? (
            <>
              <p className="font-medium">{t("microphone.window.playbackTitle")}</p>
              <audio controls src={playback.url} onPlay={playback.played} className="w-full" />
            </>
          ) : (
            <p>{t("microphone.window.noRecording")}</p>
          )}
          <button
            type="button"
            onClick={playback.done}
            className="w-full rounded-md bg-slate-900 px-3 py-2 font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
          >
            {t("microphone.window.done")}
          </button>
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
