import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export function AdBanner() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside aria-label="bottom advertisement slots" className="ad-banner shrink-0 border-t border-zinc-950 bg-zinc-900">
      <button
        className="flex h-7 w-full items-center justify-center gap-1 border-b border-zinc-950 bg-zinc-800 font-ui text-[10px] font-bold uppercase tracking-wide text-zinc-400 hover:text-amber-300"
        onClick={() => setIsCollapsed((value) => !value)}
        type="button"
      >
        {isCollapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        Ads
      </button>
      <div className={`ad-banner-slots ${isCollapsed ? "hidden" : "grid"} h-20 grid-cols-1 gap-3 px-3 py-2 md:h-24 md:grid-cols-2 md:px-6 md:py-3`}>
        <AdSlot label="Advertisement A" />
        <div className="hidden h-full md:block">
          <AdSlot label="Advertisement B" />
        </div>
      </div>
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
