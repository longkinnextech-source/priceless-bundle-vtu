export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-ember-500/25 border-t-ember-400" />
      <p className="text-sm font-medium text-ember-100/50">Loading Priceless Bundle…</p>
    </div>
  );
}
