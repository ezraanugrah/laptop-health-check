import type { AppInfo } from "../types/diagnostics";

export function AboutPage({ info }: { info: AppInfo | null }) {
  const rows: [string, string][] = info
    ? [
        ["Versi", info.version],
        ["Platform", `${info.os} (${info.arch})`],
      ]
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Tentang</h1>
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <p className="font-semibold">Laptop Health Check</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Memeriksa kondisi perangkat keras laptop secara offline. Tidak ada data yang dikirim ke
          internet — semua hasil tetap berada di perangkat ini.
        </p>
        {rows.length > 0 && (
          <dl className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-sm dark:border-slate-800">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </div>
  );
}
