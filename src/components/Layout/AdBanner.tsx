export function AdBanner() {
  return (
    <aside
      aria-label="bottom advertisement slots"
      className="grid h-24 shrink-0 grid-cols-2 gap-4 border-t border-zinc-950 bg-zinc-900 px-6 py-3"
    >
      <AdSlot label="Advertisement A" />
      <AdSlot label="Advertisement B" />
    </aside>
  );
}

function AdSlot({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center border border-dashed border-zinc-700 bg-zinc-950/60 font-ui text-[11px] uppercase tracking-[0.18em] text-zinc-500">
      {label}
    </div>
  );
}
