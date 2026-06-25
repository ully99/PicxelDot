import { useState } from "react";
import { FlipHorizontal2, FlipVertical2, RotateCcw, RotateCw } from "lucide-react";
import { copy } from "../../i18n";

type UiCopy = (typeof copy)[keyof typeof copy];

type ToolOptionsBarProps = {
  brushSize: number;
  canRedo: boolean;
  canUndo: boolean;
  mirrorX: boolean;
  mirrorY: boolean;
  onRedo: () => void;
  onSetBrushSize: (size: number) => void;
  onSetMirrorX: (enabled: boolean) => void;
  onSetMirrorY: (enabled: boolean) => void;
  onSetOpacity: (opacity: number) => void;
  onUndo: () => void;
  opacity: number;
  t: UiCopy;
};

export function ToolOptionsBar({
  brushSize,
  canRedo,
  canUndo,
  mirrorX,
  mirrorY,
  onRedo,
  onSetBrushSize,
  onSetMirrorX,
  onSetMirrorY,
  onSetOpacity,
  onUndo,
  opacity,
  t,
}: ToolOptionsBarProps) {
  const [activeMobileOption, setActiveMobileOption] = useState<"size" | "opacity" | null>(null);

  return (
    <div className="relative flex h-11 shrink-0 items-center gap-2 border-b border-zinc-950 bg-zinc-900 px-2 font-ui text-[12px] text-zinc-100 md:gap-6 md:px-3">
      <div className="hidden items-center gap-6 md:flex">
        <RangeOption label={t.size} max={8} min={1} onChange={onSetBrushSize} value={brushSize} />
        <div className="h-5 w-px shrink-0 bg-zinc-700" />
        <RangeOption
          label={t.opacity}
          max={100}
          min={10}
          onChange={onSetOpacity}
          step={5}
          suffix="%"
          value={opacity}
        />
        <div className="h-5 w-px shrink-0 bg-zinc-700" />
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1.5 md:hidden">
        <MobileOptionButton
          active={activeMobileOption === "size"}
          label={`${t.size} ${brushSize}`}
          onClick={() => setActiveMobileOption((current) => (current === "size" ? null : "size"))}
        />
        <MobileOptionButton
          active={activeMobileOption === "opacity"}
          label={`${opacity}%`}
          onClick={() => setActiveMobileOption((current) => (current === "opacity" ? null : "opacity"))}
        />
      </div>

      <label className="hidden items-center gap-1.5 md:flex">
        <input
          checked={mirrorX}
          className="h-3.5 w-3.5 accent-amber-300"
          onChange={(event) => onSetMirrorX(event.target.checked)}
          type="checkbox"
        />
        <span className="font-ui text-[12px] font-semibold">{t.mirrorX}</span>
      </label>

      <label className="hidden items-center gap-1.5 md:flex">
        <input
          checked={mirrorY}
          className="h-3.5 w-3.5 accent-amber-300"
          onChange={(event) => onSetMirrorY(event.target.checked)}
          type="checkbox"
        />
        <span className="font-ui text-[12px] font-semibold">{t.mirrorY}</span>
      </label>

      <div className="flex shrink-0 items-center gap-1.5 md:ml-auto md:gap-2">
        <button
          className={`grid h-8 w-8 place-items-center border shadow-pixel active:bg-zinc-700 md:hidden ${
            mirrorX
              ? "border-amber-300 bg-amber-300 text-zinc-950"
              : "border-zinc-950 bg-zinc-800 text-zinc-300"
          }`}
          onClick={() => onSetMirrorX(!mirrorX)}
          title={t.mirrorX}
          type="button"
        >
          <FlipHorizontal2 size={14} />
        </button>
        <button
          className={`grid h-8 w-8 place-items-center border shadow-pixel active:bg-zinc-700 md:hidden ${
            mirrorY
              ? "border-amber-300 bg-amber-300 text-zinc-950"
              : "border-zinc-950 bg-zinc-800 text-zinc-300"
          }`}
          onClick={() => onSetMirrorY(!mirrorY)}
          title={t.mirrorY}
          type="button"
        >
          <FlipVertical2 size={14} />
        </button>
        <button
          className="grid h-8 w-8 place-items-center border border-zinc-950 bg-zinc-800 text-zinc-100 shadow-pixel hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 md:w-auto md:px-3 md:text-[12px] md:font-semibold"
          disabled={!canUndo}
          onClick={onUndo}
          title={t.undo}
          type="button"
        >
          <RotateCcw className="md:hidden" size={14} />
          <span className="hidden md:inline">{t.undo}</span>
        </button>
        <button
          className="grid h-8 w-8 place-items-center border border-zinc-950 bg-zinc-800 text-zinc-100 shadow-pixel hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 md:w-auto md:px-3 md:text-[12px] md:font-semibold"
          disabled={!canRedo}
          onClick={onRedo}
          title={t.redo}
          type="button"
        >
          <RotateCw className="md:hidden" size={14} />
          <span className="hidden md:inline">{t.redo}</span>
        </button>
      </div>

      {activeMobileOption && (
        <div className="absolute left-2 top-full z-40 mt-2 flex h-44 w-20 flex-col items-center justify-between border border-zinc-950 bg-zinc-900 p-2 shadow-[0_12px_32px_rgba(0,0,0,0.55)] md:hidden">
          <span className="font-ui text-[10px] font-bold uppercase text-zinc-400">
            {activeMobileOption}
          </span>
          <input
            className="h-28 accent-amber-300"
            max={activeMobileOption === "size" ? 8 : 100}
            min={activeMobileOption === "size" ? 1 : 10}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (activeMobileOption === "size") {
                onSetBrushSize(value);
              } else {
                onSetOpacity(value);
              }
            }}
            step={activeMobileOption === "size" ? 1 : 5}
            style={{ writingMode: "vertical-lr", direction: "rtl" }}
            type="range"
            value={activeMobileOption === "size" ? brushSize : opacity}
          />
          <strong className="font-mono text-[11px] text-amber-300">
            {activeMobileOption === "size" ? brushSize : `${opacity}%`}
          </strong>
        </div>
      )}
    </div>
  );
}

function RangeOption({
  label,
  max,
  min,
  onChange,
  step = 1,
  suffix = "",
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  suffix?: string;
  value: number;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="shrink-0 font-ui text-[11px] font-bold uppercase text-zinc-400">
        {label}
      </span>
      <input
        className="w-24 accent-amber-300"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
      <strong className="w-9 text-center font-mono text-[12px] text-amber-300 tabular-nums">
        {value}{suffix}
      </strong>
    </div>
  );
}

function MobileOptionButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`h-8 shrink-0 border border-zinc-950 px-2 font-ui text-[10px] font-bold shadow-pixel ${
        active ? "bg-amber-300 text-zinc-950" : "bg-zinc-800 text-zinc-200 active:bg-zinc-700"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
