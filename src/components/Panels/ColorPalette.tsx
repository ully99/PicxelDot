import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, X } from "lucide-react";

const initialPalettes = {
  "PICO-8": [
    "#000000",
    "#1d2b53",
    "#7e2553",
    "#008751",
    "#ab5236",
    "#5f574f",
    "#c2c3c7",
    "#fff1e8",
    "#ff004d",
    "#ffa300",
    "#ffec27",
    "#00e436",
    "#29adff",
    "#83769c",
    "#ff77a8",
    "#ffccaa",
  ],
  GameBoy: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"],
  NES: [
    "#7c7c7c",
    "#0000fc",
    "#0000bc",
    "#4428bc",
    "#940084",
    "#a80020",
    "#a81000",
    "#881400",
    "#503000",
    "#007800",
    "#006800",
    "#005800",
    "#004058",
    "#f8f8f8",
    "#3cbcfc",
    "#f83800",
  ],
};

const STORAGE_KEYS = {
  palettes: "dot-maker-palettes",
  recentColors: "dot-maker-recent-colors",
  selectedPalette: "dot-maker-selected-palette",
};

const initialRecentColors = [
  "#ffec27",
  "#1d2b53",
  "#ff004d",
  "#00e436",
  "#29adff",
  "#ffffff",
];

type ColorPaletteProps = {
  background: string;
  foreground: string;
  onCollapse?: () => void;
  onSelectBackground: (color: string) => void;
  onSelectForeground: (color: string) => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
};

type Slot = "foreground" | "background";
type HsvColor = {
  h: number;
  s: number;
  v: number;
};

export function ColorPalette({
  background,
  foreground,
  onCollapse,
  onSelectBackground,
  onSelectForeground,
  isMobileOpen = false,
  onCloseMobile,
}: ColorPaletteProps) {
  const [activeSlot, setActiveSlot] = useState<Slot>("foreground");
  const [hexInput, setHexInput] = useState(toHexColor(foreground));
  const [palettes, setPalettes] = useState<Record<string, string[]>>(() =>
    loadPalettes(),
  );
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isPresetDialogOpen, setIsPresetDialogOpen] = useState(false);
  const [presetNameInput, setPresetNameInput] = useState("");
  const [selectedPalette, setSelectedPalette] = useState(() => loadSelectedPalette());
  const [recentColors, setRecentColors] = useState<string[]>(() => loadRecentColors());
  const pickerRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const activeColor = activeSlot === "foreground" ? foreground : background;
  const activeHex = useMemo(() => toHexColor(activeColor), [activeColor]);
  const [pickerHsv, setPickerHsv] = useState<HsvColor>(() => hexToHsv(toHexColor(foreground)));
  const draftHex = useMemo(() => hsvToHex(pickerHsv), [pickerHsv]);
  const draftRgb = useMemo(() => hexToRgb(draftHex), [draftHex]);
  const hueColor = hsvToHex({ h: pickerHsv.h, s: 100, v: 100 });
  const currentPalette = palettes[selectedPalette] ?? [];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.palettes, JSON.stringify(palettes));
  }, [palettes]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.recentColors, JSON.stringify(recentColors));
  }, [recentColors]);

  useEffect(() => {
    if (!palettes[selectedPalette]) {
      setSelectedPalette(Object.keys(palettes)[0] ?? "PICO-8");
      return;
    }

    localStorage.setItem(STORAGE_KEYS.selectedPalette, selectedPalette);
  }, [palettes, selectedPalette]);

  useEffect(() => {
    setHexInput(activeHex);
    if (!isPickerOpen) {
      setPickerHsv(hexToHsv(activeHex));
    }
  }, [activeHex, isPickerOpen]);

  useEffect(() => {
    setRecentColors((current) => addRecentColor(current, toHexColor(foreground)));
  }, [foreground]);

  useEffect(() => {
    setRecentColors((current) => addRecentColor(current, toHexColor(background)));
  }, [background]);

  const applyColor = (color: string, slot = activeSlot) => {
    const nextColor = toHexColor(color);

    if (!isHexColor(nextColor)) {
      return;
    }

    if (slot === "foreground") {
      onSelectForeground(nextColor);
    } else {
      onSelectBackground(nextColor);
    }

    setRecentColors((current) => addRecentColor(current, nextColor));
  };

  const handleHexSubmit = () => {
    const normalized = normalizeHexInput(hexInput);

    if (!normalized) {
      setHexInput(activeHex);
      return;
    }

    applyColor(normalized);
  };

  const updateSvFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = pickerRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const s = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    const v = clamp(100 - ((event.clientY - rect.top) / rect.height) * 100, 0, 100);
    setPickerHsv((current) => {
      const next = { ...current, s, v };
      setHexInput(hsvToHex(next));
      return next;
    });
  };

  const updateHueFromPointer = (event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = hueRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const h = clamp(((event.clientX - rect.left) / rect.width) * 360, 0, 360);
    setPickerHsv((current) => {
      const next = { ...current, h };
      setHexInput(hsvToHex(next));
      return next;
    });
  };

  const addActiveColorToPalette = () => {
    setPickerHsv(hexToHsv(activeHex));
    setHexInput(activeHex);
    setIsPickerOpen(true);
  };

  const confirmPickerColor = () => {
    const nextColor = draftHex;
    applyColor(nextColor);
    setPalettes((current) => ({
      ...current,
      [selectedPalette]: addPaletteColor(current[selectedPalette], nextColor),
    }));
  };

  const removeActiveColorFromPalette = () => {
    const colorIndex = currentPalette.indexOf(activeHex);
    const nextPalette = currentPalette.filter((color) => color !== activeHex);
    const fallbackColor = nextPalette[Math.max(0, colorIndex - 1)] ?? nextPalette[0];

    setPalettes((current) => ({
      ...current,
      [selectedPalette]: nextPalette,
    }));

    if (fallbackColor) {
      applyColor(fallbackColor);
    }
  };

  const addPreset = () => {
    setPresetNameInput(getNextPresetName(Object.keys(palettes)));
    setIsPresetDialogOpen(true);
  };

  const confirmPreset = () => {
    const fallbackName = getNextPresetName(Object.keys(palettes));
    const nextName = getUniquePresetName(
      presetNameInput.trim() || fallbackName,
      Object.keys(palettes),
    );

    setPalettes((current) => ({
      ...current,
      [nextName]: [activeHex],
    }));
    setSelectedPalette(nextName);
    setIsPresetDialogOpen(false);
  };

  const removePreset = () => {
    if (Object.keys(palettes).length <= 1) {
      return;
    }

    const nextPalettes = { ...palettes };
    delete nextPalettes[selectedPalette];
    const nextSelectedPalette = Object.keys(nextPalettes)[0];

    setPalettes(nextPalettes);
    setSelectedPalette(nextSelectedPalette);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside className={`
        palette-panel
        fixed inset-y-0 left-0 z-40 flex w-[240px] min-w-0 flex-col overflow-visible border-r border-zinc-950 bg-zinc-800 shadow-[inset_-1px_0_0_#3f3f46]
        transition-transform duration-300 ease-in-out
        ${isMobileOpen ? "transform-none" : "-translate-x-full"}
        md:relative md:inset-auto md:z-auto md:flex md:h-full md:max-h-full md:min-h-0 md:w-auto md:transform-none
      `}>
        <div className="flex h-9 shrink-0 items-center justify-between border-b border-zinc-950 bg-zinc-700 px-3 py-2 font-ui text-[13px] font-bold uppercase text-zinc-100">
          <span>Palette</span>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              className="hidden h-6 w-6 place-items-center border border-zinc-950 bg-zinc-800 text-zinc-300 hover:bg-zinc-600 hover:text-amber-300 md:grid"
              title="Collapse palette"
            >
              <ChevronLeft size={14} />
            </button>
          )}
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="grid h-6 w-6 place-items-center border border-zinc-950 bg-zinc-800 text-zinc-300 active:bg-zinc-700 md:hidden"
            >
              <X size={13} />
            </button>
          )}
        </div>

      <div className="palette-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-10 [touch-action:auto]">
      <section className="border-b border-zinc-950 p-3">
        <div className="mb-2 font-ui text-[11px] font-semibold uppercase text-zinc-300">
          Current
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SwatchCard
            active={activeSlot === "foreground"}
            color={foreground}
            label="FG"
            onClick={() => setActiveSlot("foreground")}
          />
          <SwatchCard
            active={activeSlot === "background"}
            color={background}
            label="BG"
            onClick={() => setActiveSlot("background")}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            className="h-8 border border-zinc-950 bg-zinc-700 font-ui text-[12px] font-semibold text-zinc-100 shadow-pixel hover:bg-zinc-600"
            onClick={() => {
              onSelectForeground(background);
              onSelectBackground(foreground);
            }}
            type="button"
          >
            Swap
          </button>
          <button
            className="h-8 border border-zinc-950 bg-zinc-700 font-ui text-[12px] font-semibold text-zinc-100 shadow-pixel hover:bg-zinc-600"
            onClick={() =>
              activeSlot === "foreground"
                ? setActiveSlot("background")
                : setActiveSlot("foreground")
            }
            type="button"
          >
            Target
          </button>
        </div>
      </section>

      <section className="border-b border-zinc-950 p-3">
        <div className="mb-2 flex items-center justify-between font-ui text-[11px] font-semibold uppercase text-zinc-300">
          <span>Preset</span>
          <span>{currentPalette.length}</span>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_32px_32px] gap-2">
          <select
            className="h-8 min-w-0 border border-zinc-950 bg-zinc-950 px-2 font-ui text-[11px] text-zinc-100 outline-none focus:border-amber-300"
            onChange={(event) => setSelectedPalette(event.target.value)}
            value={selectedPalette}
          >
            {Object.keys(palettes).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            className="h-8 border border-zinc-950 bg-zinc-700 font-ui text-[14px] font-bold text-zinc-100 shadow-pixel hover:bg-zinc-600"
            onClick={addPreset}
            title="Add preset"
            type="button"
          >
            +
          </button>
          <button
            className="h-8 border border-zinc-950 bg-zinc-700 font-ui text-[14px] font-bold text-zinc-100 shadow-pixel hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={Object.keys(palettes).length <= 1}
            onClick={removePreset}
            title="Remove preset"
            type="button"
          >
            -
          </button>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            className="h-8 border border-zinc-950 bg-zinc-700 font-ui text-[11px] font-semibold text-zinc-100 shadow-pixel hover:bg-zinc-600"
            onClick={addActiveColorToPalette}
            type="button"
          >
            NEW COLOR
          </button>
          <button
            className="h-8 border border-zinc-950 bg-zinc-700 font-ui text-[11px] font-semibold text-zinc-100 shadow-pixel hover:bg-zinc-600"
            onClick={removeActiveColorFromPalette}
            type="button"
          >
            DEL COLOR
          </button>
        </div>
        <div className="mt-3 grid h-[148px] auto-rows-max grid-cols-5 content-start gap-1.5 overflow-y-auto overscroll-contain p-1 [touch-action:pan-y]">
          {currentPalette.map((color) => (
            <ColorButton
              active={color === activeHex}
              color={color}
              key={color}
              onApply={applyColor}
              onSelectBackground={onSelectBackground}
            />
          ))}
        </div>
      </section>

      <section className="p-3">
        <div className="mb-2 flex items-center justify-between font-ui text-[11px] font-semibold uppercase text-zinc-300">
          <span>Recent</span>
          <span>{Math.min(recentColors.length, 10)}</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5 md:grid-cols-6">
          {recentColors.slice(0, 10).map((color) => (
            <ColorButton
              active={color === activeHex}
              color={color}
              key={color}
              onApply={applyColor}
              onSelectBackground={onSelectBackground}
            />
          ))}
        </div>
      </section>
      </div>

      {isPickerOpen ? (
        <div className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-24px)] w-[calc(100vw-32px)] max-w-[390px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-zinc-950 bg-zinc-900 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.55)] md:absolute md:left-[244px] md:top-32 md:z-20 md:w-[390px] md:translate-x-0 md:translate-y-0">
          <div className="mb-2 flex items-center justify-between border-b border-zinc-950 pb-2 font-ui text-[12px] font-bold uppercase text-zinc-100">
            <span>Select Color</span>
            <button
              className="h-6 w-6 border border-zinc-950 bg-zinc-700 hover:bg-zinc-600"
              onClick={() => setIsPickerOpen(false)}
              type="button"
            >
              x
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_160px]">
            <div>
              <div
                className="relative h-40 cursor-crosshair border border-zinc-950 [touch-action:none]"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  updateSvFromPointer(event);
                }}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    updateSvFromPointer(event);
                  }
                }}
                ref={pickerRef}
                style={{
                  background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
                }}
              >
                <div
                  className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 border border-zinc-950 bg-white shadow-[0_0_0_1px_#fff]"
                  style={{
                    left: `${pickerHsv.s}%`,
                    top: `${100 - pickerHsv.v}%`,
                  }}
                />
              </div>
              <div
                aria-label="Hue"
                className="relative mt-2 h-4 w-full cursor-ew-resize border border-zinc-950 [touch-action:none]"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  updateHueFromPointer(event);
                }}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    updateHueFromPointer(event);
                  }
                }}
                ref={hueRef}
                role="slider"
                style={{
                  background:
                    "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
                }}
                tabIndex={0}
              >
                <span
                  className="pointer-events-none absolute top-1/2 h-6 w-2 -translate-x-1/2 -translate-y-1/2 border border-zinc-950 bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.75)]"
                  style={{ left: `${(pickerHsv.h / 360) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <PreviewSwatch label="Current" color={activeHex} />
                <PreviewSwatch label="New" color={draftHex} />
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <NumberField
                  label="R"
                  onChange={(value) =>
                    updatePickerFromRgb({ ...draftRgb, r: value }, setPickerHsv, setHexInput)
                  }
                  value={draftRgb.r}
                />
                <NumberField
                  label="H"
                  max={360}
                  onChange={(value) =>
                    updatePickerHsv(
                      { ...pickerHsv, h: value },
                      setPickerHsv,
                      setHexInput,
                    )
                  }
                  value={Math.round(pickerHsv.h)}
                />
                <NumberField
                  label="G"
                  onChange={(value) =>
                    updatePickerFromRgb({ ...draftRgb, g: value }, setPickerHsv, setHexInput)
                  }
                  value={draftRgb.g}
                />
                <NumberField
                  label="S"
                  max={100}
                  onChange={(value) =>
                    updatePickerHsv(
                      { ...pickerHsv, s: value },
                      setPickerHsv,
                      setHexInput,
                    )
                  }
                  value={Math.round(pickerHsv.s)}
                />
                <NumberField
                  label="B"
                  onChange={(value) =>
                    updatePickerFromRgb({ ...draftRgb, b: value }, setPickerHsv, setHexInput)
                  }
                  value={draftRgb.b}
                />
                <NumberField
                  label="B"
                  max={100}
                  onChange={(value) =>
                    updatePickerHsv(
                      { ...pickerHsv, v: value },
                      setPickerHsv,
                      setHexInput,
                    )
                  }
                  value={Math.round(pickerHsv.v)}
                />
              </div>

              <label className="grid grid-cols-[18px_minmax(0,1fr)] items-center gap-1">
                <span className="font-ui text-[11px] font-bold text-zinc-300">#</span>
                <input
                  aria-label="Hex color"
                  className="h-7 border border-zinc-950 bg-zinc-950 px-2 font-ui text-[11px] uppercase text-zinc-100 outline-none focus:border-amber-300"
                  onBlur={() => {
                    const normalized = normalizeHexInput(hexInput);
                    setHexInput(normalized ?? draftHex);
                    if (normalized) setPickerHsv(hexToHsv(normalized));
                  }}
                  onChange={(event) => setHexInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      const normalized = normalizeHexInput(hexInput);
                      if (normalized) setPickerHsv(hexToHsv(normalized));
                      event.currentTarget.blur();
                    }
                  }}
                  spellCheck={false}
                  value={hexInput.replace("#", "")}
                />
              </label>

              <button
                className="mt-auto h-9 border border-zinc-950 bg-blue-600 font-ui text-[12px] font-bold text-white shadow-pixel hover:bg-blue-500"
                onClick={confirmPickerColor}
                type="button"
              >
                Select Color
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isPresetDialogOpen ? (
        <div className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-xs -translate-x-1/2 -translate-y-1/2 border border-zinc-950 bg-zinc-900 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.55)] md:absolute md:left-[244px] md:top-32 md:z-20 md:w-64 md:translate-x-0 md:translate-y-0">
          <div className="mb-2 flex items-center justify-between border-b border-zinc-950 pb-2 font-ui text-[12px] font-bold uppercase text-zinc-100">
            <span>New Preset</span>
            <button
              className="h-6 w-6 border border-zinc-950 bg-zinc-700 hover:bg-zinc-600"
              onClick={() => setIsPresetDialogOpen(false)}
              type="button"
            >
              x
            </button>
          </div>
          <input
            className="mb-3 h-8 w-full border border-zinc-950 bg-zinc-950 px-2 font-ui text-[12px] text-zinc-100 outline-none focus:border-amber-300"
            onChange={(event) => setPresetNameInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                confirmPreset();
              }
              if (event.key === "Escape") {
                setIsPresetDialogOpen(false);
              }
            }}
            placeholder="Preset name"
            value={presetNameInput}
          />
          <button
            className="h-9 w-full border border-zinc-950 bg-blue-600 font-ui text-[12px] font-bold text-white shadow-pixel hover:bg-blue-500"
            onClick={confirmPreset}
            type="button"
          >
            Create Preset
          </button>
        </div>
      ) : null}
    </aside>
  </>
  );
}

function PanelHeader({ label }: { label: string }) {
  return (
    <div className="h-9 border-b border-zinc-950 bg-zinc-700 px-3 py-2 font-ui text-[13px] font-bold uppercase text-zinc-100">
      {label}
    </div>
  );
}

function SwatchCard({
  active,
  color,
  label,
  onClick,
}: {
  active: boolean;
  color: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={[
        "border bg-zinc-900 p-2 text-left outline-none",
        active ? "border-amber-300" : "border-zinc-950",
      ].join(" ")}
      onClick={onClick}
      type="button"
    >
      <div className="mb-1 flex items-center justify-between font-ui text-[11px] font-semibold text-zinc-400">
        <span>{label}</span>
        {active ? <span className="text-amber-300">EDIT</span> : null}
      </div>
      <div
        className="h-10 border border-zinc-950 shadow-pixel"
        style={{ backgroundColor: color }}
      />
    </button>
  );
}

function ColorButton({
  active,
  color,
  onApply,
  onSelectBackground,
}: {
  active?: boolean;
  color: string;
  onApply: (color: string) => void;
  onSelectBackground: (color: string) => void;
}) {
  return (
    <button
      className={[
        "aspect-square border shadow-pixel outline-none hover:brightness-110 focus:ring-2 focus:ring-amber-300 [touch-action:pan-y]",
        active ? "border-amber-300" : "border-zinc-950",
      ].join(" ")}
      onClick={() => onApply(color)}
      onContextMenu={(event) => {
        event.preventDefault();
        onSelectBackground(color);
      }}
      style={{ backgroundColor: color }}
      title={`${color} / right-click for BG`}
      type="button"
    />
  );
}

function PreviewSwatch({ color, label }: { color: string; label: string }) {
  return (
    <div>
      <div className="mb-1 font-ui text-[10px] font-semibold uppercase text-zinc-400">{label}</div>
      <div
        className="h-10 border border-zinc-950"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

function NumberField({
  label,
  max = 255,
  onChange,
  value,
}: {
  label: string;
  max?: number;
  onChange: (value: number) => void;
  value: number;
}) {
  const dragRef = useRef({ startValue: value, startY: 0 });

  const updateFromDrag = (clientY: number) => {
    const delta = Math.trunc((dragRef.current.startY - clientY) / 8);
    onChange(clamp(dragRef.current.startValue + delta, 0, max));
  };

  return (
    <label className="grid grid-cols-[18px_minmax(0,1fr)] items-center gap-1">
      <span className="font-ui text-[10px] font-bold text-zinc-300 text-center">{label}</span>
      <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_14px] gap-1">
        <input
          className="no-spinner h-7 min-w-0 border border-zinc-950 bg-zinc-950 pl-1 pr-1.5 text-right font-ui text-[12px] text-zinc-100 outline-none focus:border-amber-300"
          max={max}
          min={0}
          onChange={(event) => onChange(Number(event.target.value))}
          type="number"
          value={value}
        />
        <span
          className="grid h-7 cursor-ns-resize select-none grid-rows-2 place-items-center border border-zinc-950 bg-zinc-600 hover:bg-zinc-500"
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = {
              startValue: value,
              startY: event.clientY,
            };
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              updateFromDrag(event.clientY);
            }
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onWheel={(event) => {
            event.preventDefault();
            onChange(clamp(value + (event.deltaY < 0 ? 1 : -1), 0, max));
          }}
          role="spinbutton"
          tabIndex={0}
        >
          <span className="h-0 w-0 border-x-[4px] border-b-[5px] border-x-transparent border-b-white" />
          <span className="h-0 w-0 border-x-[4px] border-t-[5px] border-x-transparent border-t-white" />
        </span>
      </span>
    </label>
  );
}

function addRecentColor(colors: string[], color: string) {
  if (!isHexColor(color)) {
    return colors;
  }

  return [color, ...colors.filter((current) => current !== color)].slice(0, 10);
}

function addPaletteColor(colors: string[] = [], color: string) {
  if (!isHexColor(color)) {
    return colors;
  }

  return [color, ...colors.filter((current) => current !== color)];
}

function loadPalettes() {
  const savedPalettes = readJson<Record<string, string[]>>(STORAGE_KEYS.palettes);

  if (!savedPalettes) {
    return initialPalettes;
  }

  const cleanedEntries = Object.entries(savedPalettes)
    .map(([name, colors]) => [
      name.trim(),
      Array.isArray(colors) ? colors.map(toHexColor).filter(isHexColor) : [],
    ] as const)
    .filter(([name, colors]) => name.length > 0 && colors.length > 0);

  if (cleanedEntries.length === 0) {
    return initialPalettes;
  }

  return Object.fromEntries(cleanedEntries);
}

function loadRecentColors() {
  const savedColors = readJson<string[]>(STORAGE_KEYS.recentColors);

  if (!Array.isArray(savedColors)) {
    return initialRecentColors;
  }

  const colors = savedColors.map(toHexColor).filter(isHexColor);

  return colors.length > 0 ? colors.slice(0, 10) : initialRecentColors;
}

function loadSelectedPalette() {
  return localStorage.getItem(STORAGE_KEYS.selectedPalette) ?? "PICO-8";
}

function readJson<T>(key: string) {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

function getNextPresetName(names: string[]) {
  let index = 1;
  let name = `Custom ${index}`;

  while (names.includes(name)) {
    index += 1;
    name = `Custom ${index}`;
  }

  return name;
}

function getUniquePresetName(name: string, names: string[]) {
  if (!names.includes(name)) {
    return name;
  }

  let index = 2;
  let nextName = `${name} ${index}`;

  while (names.includes(nextName)) {
    index += 1;
    nextName = `${name} ${index}`;
  }

  return nextName;
}

function normalizeHexInput(value: string) {
  const trimmed = value.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;

  if (/^#[0-9a-fA-F]{3}$/.test(withHash)) {
    return `#${withHash
      .slice(1)
      .split("")
      .map((character) => character + character)
      .join("")}`.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{6}$/.test(withHash)) {
    return withHash.toLowerCase();
  }

  return null;
}

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

function toHexColor(value: string) {
  const normalized = normalizeHexInput(value);

  if (normalized) {
    return normalized;
  }

  const rgbaMatch = value.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i,
  );

  if (!rgbaMatch) {
    return "#000000";
  }

  const [, red, green, blue] = rgbaMatch;

  return `#${[red, green, blue]
    .map((channel) =>
      Math.min(255, Math.max(0, Number(channel))).toString(16).padStart(2, "0"),
    )
    .join("")}`;
}

function hexToRgb(hex: string) {
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex({ b, g, r }: { b: number; g: number; r: number }) {
  return `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function updatePickerFromRgb(
  rgb: { b: number; g: number; r: number },
  setPickerHsv: (value: HsvColor) => void,
  setHexInput: (value: string) => void,
) {
  const nextHex = rgbToHex(rgb);
  setHexInput(nextHex);
  setPickerHsv(hexToHsv(nextHex));
}

function updatePickerHsv(
  hsv: HsvColor,
  setPickerHsv: (value: HsvColor) => void,
  setHexInput: (value: string) => void,
) {
  const nextHsv = {
    h: clamp(Math.round(hsv.h), 0, 360),
    s: clamp(Math.round(hsv.s), 0, 100),
    v: clamp(Math.round(hsv.v), 0, 100),
  };
  setPickerHsv(nextHsv);
  setHexInput(hsvToHex(nextHsv));
}

function hexToHsv(hex: string) {
  const red = Number.parseInt(hex.slice(1, 3), 16) / 255;
  const green = Number.parseInt(hex.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === red) h = ((green - blue) / delta) % 6;
    if (max === green) h = (blue - red) / delta + 2;
    if (max === blue) h = (red - green) / delta + 4;
    h *= 60;
  }

  return {
    h: h < 0 ? h + 360 : h,
    s: max === 0 ? 0 : (delta / max) * 100,
    v: max * 100,
  };
}

function hsvToHex({ h, s, v }: { h: number; s: number; v: number }) {
  const saturation = s / 100;
  const value = v / 100;
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = value - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (h < 60) [red, green, blue] = [chroma, x, 0];
  else if (h < 120) [red, green, blue] = [x, chroma, 0];
  else if (h < 180) [red, green, blue] = [0, chroma, x];
  else if (h < 240) [red, green, blue] = [0, x, chroma];
  else if (h < 300) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];

  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
