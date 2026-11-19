import { useEffect, useState } from "react";
import type {
  DeviceProfile,
  GateStatus,
  InteractiveResult,
  InteractiveResults,
  InteractiveTestId,
} from "../types/interactive";
import { api, inDesktopApp } from "../lib/api";
import { TEST_ORDER, noteCount, outcomeLabel, shouldRecordCancel, summarize, summaryText } from "../lib/interactive/outcome";
import { cancelledDisplay } from "../lib/interactive/display";
import { KEYBOARD_LIMITATIONS } from "../lib/interactive/keyboard";
import { TestCard } from "../components/interactive/TestCard";
import { useI18n } from "../lib/preferences";
import { translate } from "../i18n/translate";
import { DisplayTest } from "../components/interactive/DisplayTest";
import { KeyboardTest } from "../components/interactive/KeyboardTest";
import { MediaTest } from "../components/interactive/MediaTest";
import { TrackpadTest } from "../components/interactive/TrackpadTest";
import { SpeakerTest } from "../components/interactive/SpeakerTest";
import { TouchBarTest } from "../components/interactive/TouchBarTest";
import { WifiTest } from "../components/interactive/WifiTest";
import { BluetoothTest } from "../components/interactive/BluetoothTest";
import { PortsTest } from "../components/interactive/PortsTest";
import { noTouchBarResult } from "../lib/interactive/touchbar";
import type { AudioOutputs, TouchBarPresence } from "../types/peripherals";

interface Props {
  results: InteractiveResults;
  onResult: (result: InteractiveResult) => void;
}

export function InteractiveTestsPage({ results, onResult }: Props) {
  const { t } = useI18n();
  const [running, setRunning] = useState<InteractiveTestId | null>(null);
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [gate, setGate] = useState<GateStatus | null>(null);
  const [touchBar, setTouchBar] = useState<TouchBarPresence | null>(null);
  const [audio, setAudio] = useState<AudioOutputs | null>(null);
  const desktop = inDesktopApp();

  useEffect(() => {
    if (!desktop) return;
    api.getDeviceProfile().then(setProfile).catch(() => setProfile(null));
    api.mediaGateStatus().then(setGate).catch(() => setGate(null));
    // Bukti hardware Touch Bar (IORegistry/TouchBarServer), bukan nama model.
    api.getTouchBarPresence().then(setTouchBar).catch(() => setTouchBar(null));
    // Keluaran audio default (untuk peringatan Tes Speaker bila bukan speaker bawaan).
    api.getAudioOutputs().then(setAudio).catch(() => setAudio(null));
  }, [desktop]);

  // Mac tanpa Touch Bar (bukti hardware, bukan eksperimental) → "Tidak tersedia", bukan "Belum diuji".
  const touchBarAbsent = touchBar?.presence === "absent" && !touchBar.experimental;
  useEffect(() => {
    if (touchBarAbsent && !results.touchBar) onResult(noTouchBarResult());
  }, [touchBarAbsent, results.touchBar, onResult]);

  // Log verifikasi selalu dalam Bahasa Indonesia (konsisten untuk audit), apa pun bahasa UI.
  const logResult = (result: InteractiveResult) => {
    if (!desktop) return;
    const tid = (key: Parameters<typeof t>[0], params?: Parameters<typeof t>[1]) => translate("id-ID", key, params);
    const evidence = result.evidence.map(
      (e) => `${tid(e.code, e.params)} [${e.kind === "measured" ? "terukur" : "dikonfirmasi pengguna"}${e.experimental ? ", eksperimental" : ""}]`,
    );
    const notes = noteCount(result);
    const label = notes > 0 ? `${outcomeLabel(result, tid)} (${notes} catatan)` : outcomeLabel(result, tid);
    void api
      .logInteractiveResult(result.id, label, tid(result.summaryCode, result.summaryParams), evidence)
      .catch(() => undefined);
  };

  const finish = (result: InteractiveResult) => {
    onResult(result);
    logResult(result);
    setRunning(null);
  };

  const cancel = (id: InteractiveTestId, result: InteractiveResult) => {
    if (shouldRecordCancel(results[id])) onResult(result);
    logResult(result);
    setRunning(null);
  };

  const summary = summarize(results);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <p className="text-sm text-slate-600 dark:text-slate-400">{t("tests.subtitle")}</p>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-900">
        <span className="font-medium">{summaryText(summary, t)}</span>
        <span className="text-xs text-slate-600 dark:text-slate-400">{t("tests.evidenceLegend")}</span>
      </section>

      <section
        role="note"
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
      >
        <p className="font-medium">{t("tests.securityTitle")}</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
          <li>
            {t("tests.securityCamera")}
            {gate ? ` ${t("tests.gateState", { state: gate.open ? t("tests.gateOpen") : t("tests.gateClosed") })}` : ""}
          </li>
          <li>{t("tests.securityNoStore")}</li>
          <li>{t("tests.securityKeyboard")}</li>
        </ul>
      </section>

      {!desktop && (
        <p className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
          {t("tests.browserMode")}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TEST_ORDER.map((id) => (
          <TestCard
            key={id}
            id={id}
            result={results[id]}
            onStart={() => setRunning(id)}
            blockedReason={id === "touchBar" && touchBarAbsent ? t("tests.noTouchBar") : undefined}
          />
        ))}
      </div>

      {running === "display" && (
        <DisplayTest onFinish={finish} onCancel={(viewed) => cancel("display", cancelledDisplay(viewed))} />
      )}
      {running === "keyboard" && (
        <KeyboardTest
          profile={profile}
          onFinish={finish}
          onCancel={() =>
            cancel("keyboard", {
              id: "keyboard",
              outcome: "cancelled",
              summaryCode: "keyboardResult.stopped",
              evidence: [],
              limitations: KEYBOARD_LIMITATIONS,
            })
          }
        />
      )}
      {running === "trackpad" && <TrackpadTest onFinish={finish} onCancel={(r) => cancel("trackpad", r)} />}
      {running === "speakers" && (
        <SpeakerTest
          output={{ defaultIsBuiltIn: audio?.defaultOutput ? audio.defaultOutput.transport === "builtIn" : null }}
          onFinish={finish}
          onCancel={(r) => cancel("speakers", r)}
        />
      )}
      {running === "touchBar" && (
        <TouchBarTest presence={touchBar} onFinish={finish} onCancel={(r) => cancel("touchBar", r)} />
      )}
      {running === "wifi" && <WifiTest onFinish={finish} onCancel={(r) => cancel("wifi", r)} />}
      {running === "bluetooth" && <BluetoothTest onFinish={finish} onCancel={(r) => cancel("bluetooth", r)} />}
      {running === "ports" && <PortsTest onFinish={finish} onCancel={(r) => cancel("ports", r)} />}
      {running === "camera" && (
        <MediaTest kind="camera" onFinish={finish} onCancel={(r) => cancel("camera", r)} />
      )}
      {running === "microphone" && (
        <MediaTest kind="microphone" onFinish={finish} onCancel={(r) => cancel("microphone", r)} />
      )}
    </div>
  );
}
