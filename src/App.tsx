import { useCallback, useEffect, useState } from "react";
import type { AppInfo } from "./types/diagnostics";
import type { InteractiveResult, InteractiveResults, LaunchMode, MediaTask } from "./types/interactive";
import { api, inDesktopApp } from "./lib/api";
import { installMediaSafetyNet, releaseAllMedia } from "./lib/media/session";
import { Sidebar, type PageId } from "./components/Sidebar";
import { DashboardPage } from "./pages/DashboardPage";
import { InteractiveTestsPage } from "./pages/InteractiveTestsPage";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { AboutPage } from "./pages/AboutPage";
import { SelfCheckPage } from "./pages/SelfCheckPage";
import { MediaWindowPage } from "./pages/MediaWindowPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useI18n } from "./lib/preferences";

function App() {
  const { t } = useI18n();
  const [page, setPage] = useState<PageId>("dashboard");
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  // Di aplikasi desktop, mode peluncuran dibaca dulu sebelum halaman apa pun
  // (dan diagnostik otomatis) dirender.
  const [launchMode, setLaunchMode] = useState<LaunchMode | null>(inDesktopApp() ? null : "normal");
  const [results, setResults] = useState<InteractiveResults>({});
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
    <div className="flex h-screen overflow-hidden">
      <Sidebar active={page} onNavigate={navigate} version={appInfo?.version} />
      <main className="flex-1 overflow-y-auto">
        {page === "dashboard" && <DashboardPage appInfo={appInfo} />}
        {page === "tests" && <InteractiveTestsPage results={results} onResult={saveResult} />}
        {page === "reports" && (
          <ComingSoonPage title={t("reports.title")} description={t("reports.description")} phase={t("reports.phase")} />
        )}
        {page === "settings" && <SettingsPage />}
        {page === "about" && <AboutPage info={appInfo} />}
      </main>
    </div>
  );
}

export default App;
