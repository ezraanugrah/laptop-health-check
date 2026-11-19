interface Props {
  title: string;
  description: string;
  phase: string;
}

export function ComingSoonPage({ title, description, phase }: Props) {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
        <p className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-400">{phase}</p>
      </div>
    </div>
  );
}
