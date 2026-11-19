export type PageId = "dashboard" | "tests" | "reports" | "about";

const NAV: { id: PageId; label: string; soon?: boolean }[] = [
  { id: "dashboard", label: "Ringkasan" },
  { id: "tests", label: "Tes Interaktif", soon: true },
  { id: "reports", label: "Laporan", soon: true },
  { id: "about", label: "Tentang" },
];

interface Props {
  active: PageId;
  onNavigate: (page: PageId) => void;
  version?: string;
}

export function Sidebar({ active, onNavigate, version }: Props) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="px-5 pt-6 pb-4">
        <p className="text-base font-semibold tracking-tight">Laptop Health Check</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">Cek kesehatan laptopmu</p>
      </div>

      <nav className="flex-1 space-y-0.5 px-3" aria-label="Navigasi utama">
        {NAV.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                isActive
                  ? "bg-slate-900 font-medium text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {item.label}
              {item.soon && (
                <span
                  className={`text-[10px] uppercase tracking-wide ${isActive ? "opacity-70" : "text-slate-400"}`}
                >
                  Segera
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-2 border-t border-slate-200 px-5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
        Offline
        {version && <span className="ml-auto">v{version}</span>}
      </div>
    </aside>
  );
}
