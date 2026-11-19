import { useCallback, useEffect, useRef, useState } from "react";
import type { AppInfo, DiagnosticsReport } from "./types/diagnostics";
import type { InteractiveResult, InteractiveResults, LaunchMode, MediaTask } from "./types/interactive";
import { api, inDesktopApp } from "./lib/api";
import { installMediaSafetyNet, releaseAllMedia } from "./lib/media/session";
import { Sidebar, type PageId } from "./components/Sidebar";
import { DashboardPage } from "./pages/DashboardPage";
import { InteractiveTestsPage } from "./pages/InteractiveTestsPage";
import { ReportPage } from "./pages/ReportPage";
import { AboutPage } from "./pages/AboutPage";
import { SelfCheckPage } from "./pages/SelfCheckPage";
import { MediaWindowPage } from "./pages/MediaWindowPage";
import { AppHeader } from "./components/header/AppHeader";
import type { UiKey } from "./i18n/translate";
import { useI18n } from "./lib/preferences";

/** Judul halaman aktif di header global. */
const PAGE_TITLE: Record<PageId, UiKey> = {
  dashboard: "dashboard.title",
  tests: "tests.title",
  reports: "reports.title",
  about: "about.title",
};

function App() {
  const { t } = useI18n();
  const [page, setPage] = useState<PageId>("dashboard");
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  // Di aplikasi desktop, mode peluncuran dibaca dulu sebelum halaman apa pun
  // (dan diagnostik otomatis) dirender.
  const [launchMode, setLaunchMode] = useState<LaunchMode | null>(inDesktopApp() ? null : "normal");
  const [results, setResults] = useState<InteractiveResults>({});
  // Diagnostik otomatis dipakai bersama Ringkasan dan Laporan.
  const [diagnostics, setDiagnostics] = useState<DiagnosticsReport | null>(null);
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(inDesktopApp() ? null : "notDesktop");
  const diagStarted = useRef(false);
  // Tugas jendela tes media; `null` = jendela utama.
  const [mediaTask, setMediaTask] = useState<MediaTask | null>(null);

  useEffect(() => {
    if (!inDesktopApp()) return;
    // Jendela tes media dikenali dulu (mode peluncuran berlaku untuk seluruh proses).
    Promise.all([api.getMediaTask().catch(() => null), api.getLaunchMode().catch(() => "normal" as const)]).then(
      ([task, mode]) => {
        setMediaTask(task);
        setLaunchMode(mode);
      },
    );
    api.getAppInfo().then(setAppInfo).catch(() => setAppInfo(null));
  }, []);

  // Kamera/mikrofon dihentikan bila halaman ditutup atau dimuat ulang.
  useEffect(() => installMediaSafetyNet(window), []);

  const runDiagnostics = useCallback(async () => {
    if (!inDesktopApp()) return;
    setDiagRunning(true);
    setDiagError(null);
    try {
      setDiagnostics(await api.runDiagnostics());
    } catch (e) {
      setDiagError(String(e));
    } finally {
      setDiagRunning(false);
    }
  }, []);

  // Pemeriksaan otomatis sekali saat aplikasi utama siap (bukan di jendela tes media/self-check).
  useEffect(() => {
    if (launchMode !== "normal" || mediaTask || diagStarted.current || !inDesktopApp()) return;
    diagStarted.current = true;
    void runDiagnostics();
  }, [launchMode, mediaTask, runDiagnostics]);

  const navigate = useCallback((next: PageId) => {
    // Pindah halaman = semua akses media dihentikan.
    void releaseAllMedia("pindah halaman");
    setPage(next);
  }, []);

  const saveResult = useCallback(
    (result: InteractiveResult) => setResults((prev) => ({ ...prev, [result.id]: result })),
    [],
  );

  if (launchMode === null) return null;
  if (mediaTask) return <MediaWindowPage task={mediaTask} />;
  if (launchMode !== "normal") return <SelfCheckPage mode={launchMode} />;

  return (
    // Saat mencetak (PDF), hanya versi cetak laporan yang tampil.
    <div className="flex h-screen overflow-hidden print:hidden">
      <Sidebar active={page} onNavigate={navigate} version={appInfo?.version} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader title={t(PAGE_TITLE[page])} />
        <main className="flex-1 overflow-y-auto">
          {page === "dashboard" && (
            <DashboardPage
              appInfo={appInfo}
              report={diagnostics}
              running={diagRunning}
              error={diagError}
              onRun={() => void runDiagnostics()}
            />
          )}
          {page === "tests" && <InteractiveTestsPage results={results} onResult={saveResult} />}
          {page === "reports" && (
            <ReportPage
              appInfo={appInfo}
              diagnostics={diagnostics}
              interactive={results}
              running={diagRunning}
              onRunDiagnostics={() => void runDiagnostics()}
            />
          )}
          {page === "about" && <AboutPage info={appInfo} />}
        </main>
      </div>
    </div>
  );
}

export default App;
