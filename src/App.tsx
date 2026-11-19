import { useEffect, useState } from "react";
import type { AppInfo } from "./types/diagnostics";
import { api, inDesktopApp } from "./lib/api";
import { Sidebar, type PageId } from "./components/Sidebar";
import { DashboardPage } from "./pages/DashboardPage";
import { ComingSoonPage } from "./pages/ComingSoonPage";
import { AboutPage } from "./pages/AboutPage";

function App() {
  const [page, setPage] = useState<PageId>("dashboard");
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    if (inDesktopApp()) api.getAppInfo().then(setAppInfo).catch(() => setAppInfo(null));
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar active={page} onNavigate={setPage} version={appInfo?.version} />
      <main className="flex-1 overflow-y-auto">
        {page === "dashboard" && <DashboardPage appInfo={appInfo} />}
        {page === "tests" && (
          <ComingSoonPage
            title="Tes Interaktif"
            description="Tes keyboard, layar, speaker, mikrofon, kamera, touchpad, dan port USB."
            phase="Direncanakan di Fase 4"
          />
        )}
        {page === "reports" && (
          <ComingSoonPage
            title="Laporan"
            description="Simpan dan ekspor hasil pemeriksaan ke PDF dan JSON, termasuk ke flashdisk USB."
            phase="Direncanakan di Fase 5"
          />
        )}
        {page === "about" && <AboutPage info={appInfo} />}
      </main>
    </div>
  );
}

export default App;
