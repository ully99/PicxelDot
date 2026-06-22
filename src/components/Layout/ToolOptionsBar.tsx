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
}: ToolOptionsBarProps) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-6 border-b border-zinc-950 bg-zinc-900 px-3 font-ui text-[12px] text-zinc-100">
      {/* Size 컨트롤: 라벨-슬라이더-값 한 그룹 */}
      <RangeOption label="Size" max={8} min={1} onChange={onSetBrushSize} value={brushSize} />

      {/* 구분선 */}
      <div className="h-5 w-px bg-zinc-700 shrink-0" />

      {/* Opacity 컨트롤: 라벨-슬라이더-값 한 그룹 */}
      <RangeOption
        label="Opacity"
        max={100}
        min={10}
        onChange={onSetOpacity}
        step={5}
        suffix="%"
        value={opacity}
      />

      {/* 구분선 */}
      <div className="h-5 w-px bg-zinc-700 shrink-0" />

      <label className="flex items-center gap-1.5">
        <input
          checked={mirrorX}
          className="h-3.5 w-3.5 accent-amber-300"
          onChange={(event) => onSetMirrorX(event.target.checked)}
          type="checkbox"
        />
        <span className="font-ui text-[12px] font-semibold">Mirror X</span>
      </label>

      <label className="flex items-center gap-1.5">
        <input
          checked={mirrorY}
          className="h-3.5 w-3.5 accent-amber-300"
          onChange={(event) => onSetMirrorY(event.target.checked)}
          type="checkbox"
        />
        <span className="font-ui text-[12px] font-semibold">Mirror Y</span>
      </label>

      <div className="ml-auto flex items-center gap-2">
        <button
          className="h-8 border border-zinc-950 bg-zinc-800 px-3 font-ui text-[12px] font-semibold text-zinc-100 shadow-pixel hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canUndo}
          onClick={onUndo}
          type="button"
        >
          Undo
        </button>
        <button
          className="h-8 border border-zinc-950 bg-zinc-800 px-3 font-ui text-[12px] font-semibold text-zinc-100 shadow-pixel hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={!canRedo}
          onClick={onRedo}
          type="button"
        >
          Redo
        </button>
      </div>
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
    <div className="flex items-center gap-2">
      {/* 라벨 */}
      <span className="shrink-0 font-ui text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
        {label}
      </span>
      {/* 슬라이더 */}
      <input
        className="w-24 accent-amber-300"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
      {/* 현재 값 */}
      <strong className="w-9 text-center font-mono text-[12px] text-amber-300 tabular-nums">
        {value}{suffix}
      </strong>
    </div>
  );
}
