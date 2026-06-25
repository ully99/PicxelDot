import { Fragment, useEffect, useRef, useState } from "react";
import { ColorPalette } from "./components/Panels/ColorPalette";
import { Toolbar } from "./components/Panels/Toolbar";
import { ArrowRight, BookOpen, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, Download, Film, Link, LucideIcon, Pencil, Eraser, Minus, Moon, MousePointer2, PaintBucket, Pipette, ShieldCheck, Sparkles, Square, Sun, Trash2, Undo, Redo, Unlink } from "lucide-react";
import { MainCanvas } from "./components/Canvas/MainCanvas";
import { CanvasPreview } from "./components/Canvas/CanvasPreview";
import { HeaderMenu } from "./components/Layout/HeaderMenu";
import { TimelinePanel } from "./components/Panels/TimelinePanel";
import { StatusBar } from "./components/Layout/StatusBar";
import { AdBanner } from "./components/Layout/AdBanner";
import { ToolOptionsBar } from "./components/Layout/ToolOptionsBar";
import { usePixelCanvas } from "./hooks/usePixelCanvas";
import { useCanvasTransform } from "./hooks/useCanvasTransform";
import { Pixel } from "./types";
import { LanguageToggle, useLanguage } from "./i18n";

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);
  const languageState = useLanguage();

  useEffect(() => {
    const handlePopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (nextPath: string) => {
    window.history.pushState({}, "", nextPath);
    setPath(nextPath);
    window.scrollTo({ top: 0 });
  };

  const isEditorPreview = new URLSearchParams(window.location.search).get("preview") === "editor";

  if (isEditorPreview || path === "/create" || path === "/editor") {
    return <EditorApp isPreview={isEditorPreview} languageState={languageState} onHome={() => navigate("/")} />;
  }

  return <HomePage languageState={languageState} onStart={() => navigate("/create")} />;
}

function EditorApp({
  isPreview = false,
  languageState,
  onHome,
}: {
  isPreview?: boolean;
  languageState: ReturnType<typeof useLanguage>;
  onHome: () => void;
}) {
  const pixelCanvas = usePixelCanvas();
  const canvasTransform = useCanvasTransform(1);
  const { language, setLanguage, t } = languageState;
  const [onionSkinEnabled, setOnionSkinEnabled] = useState(true);
  const [isMobilePaletteOpen, setIsMobilePaletteOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"tools" | "matrix">("tools");
  const [isMobileControlsCollapsed, setIsMobileControlsCollapsed] = useState(false);
  const [isPcPaletteCollapsed, setIsPcPaletteCollapsed] = useState(false);
  const [isPcToolbarCollapsed, setIsPcToolbarCollapsed] = useState(false);
  const [mobileMatrixMenu, setMobileMatrixMenu] = useState<{
    frameId: string;
    layerId: string;
    x: number;
    y: number;
  } | null>(null);
  const longPressRef = useRef<number | null>(null);
  const previewSeededRef = useRef(false);
  const [mobilePaletteColors, setMobilePaletteColors] = useState<string[]>([
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
  ]);

  useEffect(() => {
    return () => {
      if (longPressRef.current !== null) {
        window.clearTimeout(longPressRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isPreview || previewSeededRef.current) {
      return;
    }

    previewSeededRef.current = true;
    pixelCanvas.importCanvas(createPreviewPixels(), 32, 32);
    pixelCanvas.setActiveTool("pencil");
  }, [isPreview, pixelCanvas]);

  const handleQuickExportPNG = () => {
    const activeMatrix = pixelCanvas.matrices.find((m) => m.id === pixelCanvas.activeMatrixId) || pixelCanvas.matrices[0];
    const frame = activeMatrix.frames.find((f) => f.id === pixelCanvas.activeFrameId);
    if (!frame) return;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = pixelCanvas.width * 16;
    tempCanvas.height = pixelCanvas.height * 16;
    const ctx = tempCanvas.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = false;

      pixelCanvas.layers.forEach((layer) => {
        if (!layer.visible) return;
        const resolved = pixelCanvas.getResolvedCel(frame.id, layer.id);
        if (!resolved) return;

        resolved.cel.pixels.forEach((color, index) => {
          if (!color) return;
          ctx.fillStyle = color;
          const px = (index % pixelCanvas.width) * 16;
          const py = Math.floor(index / pixelCanvas.width) * 16;
          ctx.fillRect(px, py, 16, 16);
        });
      });

      const url = tempCanvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `drawing-${Date.now()}.png`;
      link.href = url;
      link.click();
    }
  };

  const activeFrameIndex = pixelCanvas.frames.findIndex((frame) => frame.id === pixelCanvas.activeFrameId);
  const activeLayerIndex = pixelCanvas.layers.findIndex((layer) => layer.id === pixelCanvas.activeLayerId);

  return (
    <div className="app-shell flex h-dvh min-w-0 flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <HeaderMenu
        canvas={pixelCanvas}
        language={language}
        onLanguageChange={setLanguage}
        onNavigateHome={onHome}
        onionSkinEnabled={onionSkinEnabled}
        onTogglePreviousFrame={() => setOnionSkinEnabled((prev) => !prev)}
      />
      <ToolOptionsBar
        brushSize={pixelCanvas.brushSize}
        canRedo={pixelCanvas.canRedo}
        canUndo={pixelCanvas.canUndo}
        mirrorX={pixelCanvas.mirrorX}
        mirrorY={pixelCanvas.mirrorY}
        onRedo={pixelCanvas.redo}
        onSetBrushSize={pixelCanvas.setBrushSize}
        onSetMirrorX={pixelCanvas.setMirrorX}
        onSetMirrorY={pixelCanvas.setMirrorY}
        onSetOpacity={pixelCanvas.setOpacity}
        onResetView={canvasTransform.resetTransform}
        onUndo={pixelCanvas.undo}
        opacity={pixelCanvas.opacity}
        t={t}
      />

      <main
        className={`editor-shell grid min-h-0 min-w-0 flex-1 grid-cols-1 border-y border-zinc-950 bg-zinc-900 ${
          isPcPaletteCollapsed && isPcToolbarCollapsed
            ? "md:grid-cols-[28px_minmax(0,1fr)_28px]"
            : isPcPaletteCollapsed
            ? "md:grid-cols-[28px_minmax(0,1fr)_76px]"
            : isPcToolbarCollapsed
            ? "md:grid-cols-[232px_minmax(0,1fr)_28px]"
            : "md:grid-cols-[232px_minmax(0,1fr)_76px]"
        }`}
      >
        {isPcPaletteCollapsed ? (
          <button
            className="hidden min-h-0 border-r border-zinc-950 bg-zinc-900 text-amber-300 shadow-[inset_-1px_0_0_#3f3f46] hover:bg-zinc-800 md:grid md:place-items-center"
            onClick={() => setIsPcPaletteCollapsed(false)}
            title={t.expandPalette}
            type="button"
          >
            <span className="grid h-full w-full place-items-center border-r border-zinc-950">
              <ChevronRight size={16} />
            </span>
          </button>
        ) : (
          <ColorPalette
            background={pixelCanvas.background}
            foreground={pixelCanvas.foreground}
            onCollapse={() => setIsPcPaletteCollapsed(true)}
            onCurrentPaletteChange={setMobilePaletteColors}
            onSelectBackground={pixelCanvas.setBackground}
            onSelectForeground={pixelCanvas.setForeground}
            isMobileOpen={isMobilePaletteOpen}
            onCloseMobile={() => setIsMobilePaletteOpen(false)}
          />
        )}
        <div className="relative flex flex-col min-w-0 flex-1">
          <MainCanvas
            canvas={pixelCanvas}
            transform={canvasTransform}
            onionSkinEnabled={onionSkinEnabled}
          />
          {/* Mobile Tabbed Controls Panel */}
          <div className="flex shrink-0 select-none flex-col gap-1.5 border-t border-zinc-950 bg-zinc-900 p-1.5 text-xs md:hidden">
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-0.5 [touch-action:pan-x]">
                {mobilePaletteColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => pixelCanvas.setForeground(color)}
                    className={`h-6 w-6 rounded border shrink-0 transition-transform ${
                      pixelCanvas.foreground.toLowerCase() === color.toLowerCase()
                        ? "border-amber-300 scale-105"
                        : "border-zinc-950"
                    }`}
                    style={{ backgroundColor: color }}
                    type="button"
                  />
                ))}
              </div>
              <button
                onClick={() => setIsMobilePaletteOpen(true)}
                className="h-6 shrink-0 border border-zinc-950 bg-zinc-800 px-2.5 font-ui text-[10px] font-bold text-amber-300 active:bg-zinc-700"
                type="button"
              >
                {t.palette}
              </button>
            </div>

            <div className="grid grid-cols-[1fr_1fr_28px] gap-1 border border-zinc-950 bg-zinc-950 p-0.5">
              {(["tools", "matrix"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setMobileTab(tab);
                    setIsMobileControlsCollapsed(false);
                  }}
                  className={`py-1 font-ui text-[11px] font-bold capitalize transition-colors ${
                    mobileTab === tab ? "bg-zinc-800 text-amber-300" : "text-zinc-400 hover:text-zinc-300"
                  }`}
                  type="button"
                >
                  {tab === "tools" ? t.tools : t.matrix}
                </button>
              ))}
              <button
                className="grid place-items-center bg-zinc-800 text-zinc-300 active:bg-zinc-700"
                onClick={() => setIsMobileControlsCollapsed((current) => !current)}
                type="button"
              >
                {isMobileControlsCollapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>

            {!isMobileControlsCollapsed && (
              <>
            <div className="flex min-h-[40px] items-center overflow-hidden border border-zinc-950 bg-zinc-950/40 p-1.5">
              {mobileTab === "tools" && (
                <div className="flex w-full items-center justify-start gap-2 overflow-x-auto [touch-action:pan-x]">
                  {[
                    { icon: Pencil, value: "pencil", label: "Pencil" },
                    { icon: Eraser, value: "eraser", label: "Eraser" },
                    { icon: PaintBucket, value: "bucket", label: "Bucket" },
                    { icon: Pipette, value: "eyedropper", label: "Picker" },
                    { icon: Minus, value: "line", label: "Line" },
                    { icon: Square, value: "rectangle", label: "Rectangle" },
                    { icon: Circle, value: "ellipse", label: "Ellipse" },
                    { icon: Sun, value: "lighten", label: "Lighten" },
                    { icon: Moon, value: "darken", label: "Darken" },
                    { icon: MousePointer2, value: "selection", label: "Selection" },
                  ].map(({ icon: Icon, value, label }) => (
                    <button
                      key={value}
                      onClick={() => pixelCanvas.setActiveTool(value as any)}
                      className={`grid h-8 w-9 shrink-0 place-items-center border border-zinc-950 font-ui text-[11px] font-bold transition-colors ${
                        pixelCanvas.activeTool === value
                          ? "bg-amber-300 text-zinc-950 border-amber-300"
                          : "bg-zinc-800 text-zinc-300"
                      }`}
                      title={label}
                      type="button"
                    >
                      <Icon size={15} />
                    </button>
                  ))}
                </div>
              )}

              {mobileTab === "matrix" && (
                <div className="flex w-full flex-col gap-1.5 overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => pixelCanvas.setIsPlaying(true)}
                      className="h-7 shrink-0 border border-zinc-950 bg-zinc-800 px-2.5 font-ui text-[10px] font-bold text-zinc-300 active:bg-zinc-700"
                      type="button"
                    >
                      {t.play}
                    </button>
                    <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto [touch-action:pan-x]">
                      {pixelCanvas.frames.map((frame, index) => {
                        const isSelected = frame.id === pixelCanvas.activeFrameId;
                        return (
                          <button
                            key={frame.id}
                            onClick={() => pixelCanvas.setActiveFrameId(frame.id)}
                            className={`flex h-7 w-7 shrink-0 items-center justify-center border font-pixel text-[10px] ${
                              isSelected ? "border-amber-300 bg-amber-300 text-zinc-950 font-bold" : "border-zinc-950 bg-zinc-800 text-zinc-400"
                            }`}
                            type="button"
                          >
                            {index + 1}
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={() => pixelCanvas.addFrame()}
                      className="h-7 shrink-0 border border-zinc-950 bg-zinc-800 px-2 font-ui text-[10px] font-bold text-zinc-300 active:bg-zinc-700"
                      type="button"
                    >
                      +F
                    </button>
                    <button
                      onClick={pixelCanvas.addLayer}
                      className="h-7 shrink-0 border border-zinc-950 bg-zinc-800 px-2 font-ui text-[10px] font-bold text-zinc-300 active:bg-zinc-700"
                      type="button"
                    >
                      +L
                    </button>
                  </div>
                  <div className="max-h-28 overflow-auto border border-zinc-950 bg-zinc-950/60 [touch-action:auto]">
                    <div
                      className="grid min-w-max font-ui text-[10px]"
                      style={{
                        gridTemplateColumns: `68px repeat(${pixelCanvas.frames.length}, 28px)`,
                      }}
                    >
                      <div className="sticky left-0 z-10 h-6 border-b border-r border-zinc-950 bg-zinc-950" />
                      {pixelCanvas.frames.map((frame, index) => (
                        <button
                          key={frame.id}
                          onClick={() => pixelCanvas.setActiveFrameId(frame.id)}
                          className={`h-6 border-b border-r border-zinc-950 text-[9px] ${
                            frame.id === pixelCanvas.activeFrameId
                              ? "bg-amber-300 text-zinc-950"
                              : "bg-zinc-900 text-zinc-400"
                          }`}
                          type="button"
                        >
                          {index + 1}
                        </button>
                      ))}

                      {[...pixelCanvas.layers].reverse().map((layer) => {
                        const isSelected = layer.id === pixelCanvas.activeLayerId;
                        return (
                          <Fragment key={layer.id}>
                            <button
                              className={`sticky left-0 z-10 h-7 min-w-0 truncate border-b border-r border-zinc-950 px-1.5 text-left font-bold ${
                                isSelected ? "bg-amber-300/20 text-amber-300" : "bg-zinc-900 text-zinc-300"
                              }`}
                              onClick={() => pixelCanvas.setActiveLayerId(layer.id)}
                              type="button"
                            >
                              {layer.name}
                            </button>
                            {pixelCanvas.frames.map((frame) => {
                              const isCellSelected = isSelected && frame.id === pixelCanvas.activeFrameId;
                              const frameIndex = pixelCanvas.frames.findIndex((item) => item.id === frame.id);
                              const cel = frame.cels.find((item) => item.layerId === layer.id);
                              const isLinkedToPrev = frameIndex > 0 && !!cel?.linkedToFrameId;
                              const isLinkedToNext =
                                frameIndex < pixelCanvas.frames.length - 1 &&
                                !!pixelCanvas.frames[frameIndex + 1].cels.find((item) => item.layerId === layer.id)?.linkedToFrameId;
                              const resolved = pixelCanvas.getResolvedCel(frame.id, layer.id);
                              const hasPixels = resolved?.cel.pixels.some((pixel) => pixel !== null);
                              const isLinked = isLinkedToPrev || isLinkedToNext;

                              return (
                                <button
                                  className={`relative h-7 border-b border-r border-zinc-950 text-[9px] ${
                                    isCellSelected
                                      ? "bg-amber-300 text-zinc-950"
                                      : hasPixels
                                      ? "bg-zinc-700 text-zinc-200"
                                      : "bg-zinc-900 text-zinc-500"
                                  }`}
                                  key={`${layer.id}-${frame.id}`}
                                  onClick={() => {
                                    pixelCanvas.setActiveLayerId(layer.id);
                                    pixelCanvas.setActiveFrameId(frame.id);
                                  }}
                                  onPointerDown={(event) => {
                                    if (longPressRef.current !== null) {
                                      window.clearTimeout(longPressRef.current);
                                    }
                                    longPressRef.current = window.setTimeout(() => {
                                      setMobileMatrixMenu({
                                        frameId: frame.id,
                                        layerId: layer.id,
                                        x: event.clientX,
                                        y: event.clientY,
                                      });
                                    }, 520);
                                  }}
                                  onPointerLeave={() => {
                                    if (longPressRef.current !== null) {
                                      window.clearTimeout(longPressRef.current);
                                    }
                                  }}
                                  onPointerUp={() => {
                                    if (longPressRef.current !== null) {
                                      window.clearTimeout(longPressRef.current);
                                    }
                                  }}
                                  type="button"
                                >
                                  {isLinked ? (
                                    <span
                                      className={`absolute top-1/2 h-3 -translate-y-1/2 bg-white shadow-[0_0_0_1px_rgba(255,255,255,0.25)] ${
                                        isLinkedToPrev ? "-left-px" : "left-1/2"
                                      } ${isLinkedToNext ? "-right-px" : "right-1/2"} ${
                                        !isLinkedToPrev ? "rounded-l-full" : ""
                                      } ${!isLinkedToNext ? "rounded-r-full" : ""}`}
                                    />
                                  ) : hasPixels ? (
                                    <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-zinc-100 bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" />
                                  ) : null}
                                </button>
                              );
                            })}
                          </Fragment>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Action Row */}
            <div className="flex items-center justify-between gap-2 border-t border-zinc-950/50 pt-2">
              <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5 [touch-action:pan-x]">
                <button
                  onClick={() => canvasTransform.setZoom((z) => Math.min(16, z + 0.5))}
                  className="grid h-7 w-8 place-items-center border border-zinc-950 bg-zinc-800 text-xs font-bold text-zinc-300 active:bg-zinc-700"
                  type="button"
                >
                  +
                </button>
                <button
                  onClick={() => canvasTransform.setZoom((z) => Math.max(0.5, z - 0.5))}
                  className="grid h-7 w-8 place-items-center border border-zinc-950 bg-zinc-800 text-xs font-bold text-zinc-300 active:bg-zinc-700"
                  type="button"
                >
                  -
                </button>
                <button
                  onClick={pixelCanvas.undo}
                  disabled={!pixelCanvas.canUndo}
                  className="grid h-7 w-8 place-items-center border border-zinc-950 bg-zinc-800 text-zinc-300 disabled:opacity-30 active:bg-zinc-700"
                  type="button"
                >
                  <Undo size={13} />
                </button>
                <button
                  onClick={pixelCanvas.redo}
                  disabled={!pixelCanvas.canRedo}
                  className="grid h-7 w-8 place-items-center border border-zinc-950 bg-zinc-800 text-zinc-300 disabled:opacity-30 active:bg-zinc-700"
                  type="button"
                >
                  <Redo size={13} />
                </button>
                <button
                  onClick={() => pixelCanvas.reorderLayer(pixelCanvas.activeLayerId, "up")}
                  disabled={activeLayerIndex < 0 || activeLayerIndex >= pixelCanvas.layers.length - 1}
                  className="grid h-7 w-8 shrink-0 place-items-center border border-zinc-950 bg-zinc-800 text-zinc-300 disabled:opacity-30 active:bg-zinc-700"
                  title="Move layer up"
                  type="button"
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  onClick={() => pixelCanvas.reorderLayer(pixelCanvas.activeLayerId, "down")}
                  disabled={activeLayerIndex <= 0}
                  className="grid h-7 w-8 shrink-0 place-items-center border border-zinc-950 bg-zinc-800 text-zinc-300 disabled:opacity-30 active:bg-zinc-700"
                  title="Move layer down"
                  type="button"
                >
                  <ChevronDown size={13} />
                </button>
                <button
                  onClick={() => pixelCanvas.reorderFrame(pixelCanvas.activeFrameId, "left")}
                  disabled={activeFrameIndex <= 0}
                  className="grid h-7 w-8 shrink-0 place-items-center border border-zinc-950 bg-zinc-800 text-zinc-300 disabled:opacity-30 active:bg-zinc-700"
                  title="Move frame left"
                  type="button"
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  onClick={() => pixelCanvas.reorderFrame(pixelCanvas.activeFrameId, "right")}
                  disabled={activeFrameIndex < 0 || activeFrameIndex >= pixelCanvas.frames.length - 1}
                  className="grid h-7 w-8 shrink-0 place-items-center border border-zinc-950 bg-zinc-800 text-zinc-300 disabled:opacity-30 active:bg-zinc-700"
                  title="Move frame right"
                  type="button"
                >
                  <ChevronRight size={13} />
                </button>
              </div>

              <button
                onClick={handleQuickExportPNG}
                className="h-7 shrink-0 rounded bg-amber-400 px-3 font-ui text-[11px] font-bold text-zinc-950 shadow-pixel active:bg-amber-300"
                type="button"
              >
                {t.saveDrawing}
              </button>
            </div>
              </>
            )}
          </div>
          <div className="hidden md:block">
            <TimelinePanel
              canvas={pixelCanvas}
              onionSkinEnabled={onionSkinEnabled}
              onTogglePreviousFrame={() => setOnionSkinEnabled((prev) => !prev)}
            />
          </div>
        </div>
        {isPcToolbarCollapsed ? (
          <button
            className="hidden min-h-0 border-l border-zinc-950 bg-zinc-900 text-amber-300 shadow-[inset_1px_0_0_#3f3f46] hover:bg-zinc-800 md:grid md:place-items-center"
            onClick={() => setIsPcToolbarCollapsed(false)}
            title={t.expandTools}
            type="button"
          >
            <span className="grid h-full w-full place-items-center border-l border-zinc-950">
              <ChevronLeft size={16} />
            </span>
          </button>
        ) : (
          <Toolbar
            activeTool={pixelCanvas.activeTool}
            language={language}
            onCollapse={() => setIsPcToolbarCollapsed(true)}
            onSelectTool={pixelCanvas.setActiveTool}
          />
        )}
      </main>

      <StatusBar
        canvasSize={`${pixelCanvas.width} x ${pixelCanvas.height}`}
        cursorPoint={pixelCanvas.cursorPoint}
        language={language}
        tool={pixelCanvas.activeTool}
        zoom={`${Math.round(canvasTransform.zoom * 100)}%`}
      />
      {!isPreview && <AdBanner />}
      {pixelCanvas.isPlaying && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-zinc-950 p-4 md:hidden">
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div className="h-[min(82vw,70dvh)] w-[min(92vw,70dvh)]">
              <CanvasPreview
                activeFrameId={pixelCanvas.activeFrameId}
                fps={pixelCanvas.fps}
                frames={pixelCanvas.frames}
                getResolvedCel={pixelCanvas.getResolvedCel}
                height={pixelCanvas.height}
                isPlaying={pixelCanvas.isPlaying}
                layers={pixelCanvas.layers}
                onClose={() => pixelCanvas.setIsPlaying(false)}
                fullscreen
                width={pixelCanvas.width}
              />
            </div>
          </div>
          <button
            className="mt-4 h-11 shrink-0 border border-zinc-950 bg-amber-300 font-ui text-[12px] font-black uppercase text-zinc-950 shadow-pixel"
            onClick={() => pixelCanvas.setIsPlaying(false)}
            type="button"
          >
            {t.stopPreview}
          </button>
        </div>
      )}
      {mobileMatrixMenu && (
        <div
          className="fixed z-[80] w-48 border border-zinc-950 bg-zinc-900 py-1 font-ui text-[11px] text-zinc-100 shadow-[0_8px_24px_rgba(0,0,0,0.6)] md:hidden"
          style={{
            left: Math.min(mobileMatrixMenu.x, window.innerWidth - 200),
            top: Math.min(mobileMatrixMenu.y, window.innerHeight - 130),
          }}
        >
          {pixelCanvas.frames.findIndex((frame) => frame.id === mobileMatrixMenu.frameId) > 0 && (
            <button
              className="flex w-full items-center gap-1.5 px-3 py-2 text-left hover:bg-zinc-800"
              onClick={() => {
                pixelCanvas.linkCelToPrevious(mobileMatrixMenu.frameId, mobileMatrixMenu.layerId);
                setMobileMatrixMenu(null);
              }}
              type="button"
            >
              <Link size={12} className="text-blue-400" />
              {t.linkPrevious}
            </button>
          )}
          {(() => {
            const frame = pixelCanvas.frames.find((item) => item.id === mobileMatrixMenu.frameId);
            const cel = frame?.cels.find((item) => item.layerId === mobileMatrixMenu.layerId);
            if (!cel?.linkedToFrameId) {
              return null;
            }
            return (
              <button
                className="flex w-full items-center gap-1.5 px-3 py-2 text-left hover:bg-zinc-800"
                onClick={() => {
                  pixelCanvas.unlinkCel(mobileMatrixMenu.frameId, mobileMatrixMenu.layerId);
                  setMobileMatrixMenu(null);
                }}
                type="button"
              >
                <Unlink size={12} className="text-red-400" />
                {t.unlinkCel}
              </button>
            );
          })()}
          <button
            className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-red-400 hover:bg-zinc-800"
            onClick={() => {
              pixelCanvas.clearCel(mobileMatrixMenu.frameId, mobileMatrixMenu.layerId);
              setMobileMatrixMenu(null);
            }}
            type="button"
          >
            <Trash2 size={12} />
            {t.clearCel}
          </button>
        </div>
      )}
    </div>
  );
}

function HomePage({
  languageState,
  onStart,
}: {
  languageState: ReturnType<typeof useLanguage>;
  onStart: () => void;
}) {
  const { language, setLanguage, t } = languageState;
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-900 bg-zinc-950/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button
            className="font-pixel text-[18px] font-black uppercase tracking-widest text-amber-300"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            type="button"
          >
            MAKE PIXEL DOT
          </button>
          <nav className="hidden items-center gap-6 font-ui text-sm text-zinc-300 md:flex">
            <a className="hover:text-amber-300" href="/guide.html">{t.navGuide}</a>
            <a className="hover:text-amber-300" href="/about.html">{t.navAbout}</a>
            <a className="hover:text-amber-300" href="/privacy.html">{t.navPrivacy}</a>
            <a className="hover:text-amber-300" href="/terms.html">{t.navTerms}</a>
          </nav>
          <div className="flex items-center gap-2">
            <LanguageToggle language={language} onChange={setLanguage} />
            <button
              className="inline-flex h-9 items-center gap-2 border border-amber-200 bg-amber-300 px-3 font-ui text-sm font-black text-zinc-950 shadow-pixel hover:bg-amber-200"
              onClick={onStart}
              type="button"
            >
              {t.create}
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-zinc-900 bg-zinc-900">
          <div className="absolute inset-0 pixel-grid opacity-45" />
          <div className="mx-auto grid min-h-[calc(100vh-56px)] max-w-6xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[0.86fr_1.14fr] lg:py-16">
            <div className="relative z-10 max-w-xl">
              <p className="mb-4 inline-flex border border-zinc-700 bg-zinc-950 px-2.5 py-1 font-ui text-xs font-bold uppercase tracking-wider text-amber-300">
                {t.badge}
              </p>
              <h1 className="max-w-xl font-ui text-[34px] font-extrabold leading-[1.12] tracking-normal text-white sm:text-[48px] lg:text-[52px]">
                {t.headline}
              </h1>
              <p className="mt-5 max-w-lg text-base leading-7 text-zinc-300">
                {t.intro}
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  className="inline-flex h-12 items-center gap-2 border border-amber-200 bg-amber-300 px-5 font-ui text-base font-black text-zinc-950 shadow-pixel hover:bg-amber-200"
                  onClick={onStart}
                  type="button"
                >
                  {t.createPixelArt}
                  <Pencil size={18} />
                </button>
                <a
                  className="inline-flex h-12 items-center gap-2 border border-zinc-700 bg-zinc-950 px-5 font-ui text-sm font-bold text-zinc-200 hover:border-amber-300 hover:text-amber-300"
                  href="/guide.html"
                >
                  {t.readGuide}
                  <BookOpen size={17} />
                </a>
              </div>
              <div className="mt-8 grid max-w-lg grid-cols-3 gap-3 border-t border-zinc-800 pt-5 font-ui text-xs text-zinc-400">
                <span><strong className="block text-zinc-100">32 x 32</strong>{t.defaultCanvas}</span>
                <span><strong className="block text-zinc-100">Layers</strong>{t.frameCels}</span>
                <span><strong className="block text-zinc-100">GIF/PNG</strong>{t.exports}</span>
              </div>
            </div>

            <div className="relative z-10">
              <EditorLivePreview onStart={onStart} t={t} />
            </div>
          </div>
        </section>

        <section className="bg-zinc-950 px-4 py-12 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h2 className="font-ui text-2xl font-black text-white">{t.examplesTitle}</h2>
                <p className="mt-1 text-sm text-zinc-400">{t.examplesText}</p>
              </div>
              <button
                className="hidden h-9 border border-zinc-700 bg-zinc-900 px-3 font-ui text-sm font-bold text-zinc-200 hover:border-amber-300 hover:text-amber-300 md:inline-flex md:items-center md:gap-2"
                onClick={onStart}
                type="button"
              >
                {t.openEditor}
                <ArrowRight size={15} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {exampleSprites.map((sprite) => (
                <div className="border border-zinc-800 bg-zinc-900 p-3" key={sprite.name}>
                  <AnimatedPixelSprite frames={sprite.frames} />
                  <div className="mt-2 font-ui text-xs font-bold text-zinc-200">{sprite.name}</div>
                  <div className="text-[11px] text-zinc-500">{sprite.caption}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-zinc-900 bg-zinc-900 px-4 py-12 sm:px-6">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <h2 className="font-ui text-2xl font-black text-white">{t.useCasesTitle}</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">{t.useCasesText}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <InfoRow icon={Pencil} title={t.useCaseSpritesTitle} text={t.useCaseSpritesText} />
              <InfoRow icon={Square} title={t.useCaseIconsTitle} text={t.useCaseIconsText} />
              <InfoRow icon={Sparkles} title={t.useCaseLearningTitle} text={t.useCaseLearningText} />
            </div>
          </div>
        </section>

        <section className="bg-zinc-950 px-4 py-12 sm:px-6">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <h2 className="font-ui text-2xl font-black text-white">{t.workflowTitle}</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">{t.workflowText}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  className="inline-flex h-10 items-center gap-2 border border-zinc-700 bg-zinc-900 px-4 font-ui text-sm font-bold text-zinc-200 hover:border-amber-300 hover:text-amber-300"
                  href="/guide.html"
                >
                  {t.guideFaq}
                  <BookOpen size={16} />
                </a>
                <button
                  className="inline-flex h-10 items-center gap-2 border border-amber-200 bg-amber-300 px-4 font-ui text-sm font-black text-zinc-950 shadow-pixel hover:bg-amber-200"
                  onClick={onStart}
                  type="button"
                >
                  {t.openEditor}
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
            <ol className="grid grid-cols-1 gap-3 text-sm text-zinc-300">
              {[t.workflowStepOne, t.workflowStepTwo, t.workflowStepThree, t.workflowStepFour].map((step, index) => (
                <li className="grid grid-cols-[34px_1fr] gap-3 border border-zinc-800 bg-zinc-900 p-4" key={step}>
                  <span className="grid h-8 w-8 place-items-center border border-zinc-700 bg-zinc-950 font-mono text-xs font-black text-amber-300">
                    {index + 1}
                  </span>
                  <span className="self-center leading-6 text-zinc-400">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-y border-zinc-900 bg-zinc-900 px-4 py-12 sm:px-6">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-3">
            <Feature icon={Sparkles} title={t.featurePaletteTitle} text={t.featurePaletteText} />
            <Feature icon={Film} title={t.featureAnimationTitle} text={t.featureAnimationText} />
            <Feature icon={ShieldCheck} title={t.featureLocalTitle} text={t.featureLocalText} />
          </div>
        </section>

        <section className="bg-zinc-950 px-4 py-12 sm:px-6">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <h2 className="font-ui text-2xl font-black text-white">{t.builtTitle}</h2>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                {t.builtText}
              </p>
              <p className="mt-3 text-sm leading-7 text-zinc-400">
                {t.localFirstText}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoRow icon={MousePointer2} title={t.selectionWorkflow} text={t.selectionWorkflowText} />
              <InfoRow icon={Download} title={t.exportOptions} text={t.exportOptionsText} />
              <InfoRow icon={Sun} title={t.lightenTool} text={t.lightenToolText} />
              <InfoRow icon={Moon} title={t.darkenTool} text={t.darkenToolText} />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-900 bg-zinc-950 px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <span>{t.footer}</span>
          <div className="flex flex-wrap gap-4">
            <a className="hover:text-zinc-300" href="/guide.html">{t.guideFaq}</a>
            <a className="hover:text-zinc-300" href="/about.html">{t.aboutContact}</a>
            <a className="hover:text-zinc-300" href="/privacy.html">{t.navPrivacy}</a>
            <a className="hover:text-zinc-300" href="/terms.html">{t.navTerms}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function EditorLivePreview({
  onStart,
  t,
}: {
  onStart: () => void;
  t: ReturnType<typeof useLanguage>["t"];
}) {
  return (
    <div className="border border-zinc-950 bg-zinc-950 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
      <div className="flex h-7 items-center gap-1.5 border-b border-zinc-900 bg-zinc-800 px-2">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        <span className="ml-3 h-3 w-40 bg-zinc-700" />
        <span className="ml-auto font-ui text-[10px] font-bold uppercase text-zinc-500">Live editor preview</span>
      </div>
      <div className="relative h-[360px] overflow-hidden bg-zinc-950 sm:h-[450px]">
        <iframe
          className="pointer-events-none absolute left-0 top-0 h-[760px] w-[1148px] origin-top-left scale-[0.48] border-0 sm:scale-[0.56] lg:scale-[0.56] xl:scale-[0.56]"
          src="/?preview=editor"
          title="MAKE PIXEL DOT editor preview"
        />
        <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]" />
        <button
          className="absolute bottom-3 right-3 inline-flex h-9 items-center gap-2 border border-amber-200 bg-amber-300 px-3 font-ui text-sm font-black text-zinc-950 shadow-pixel hover:bg-amber-200"
          onClick={onStart}
          type="button"
        >
          {t.openEditor}
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

function AnimatedPixelSprite({ frames }: { frames: string[][] }) {
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    if (frames.length <= 1) {
      return;
    }

    const interval = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % frames.length);
    }, 420);

    return () => window.clearInterval(interval);
  }, [frames.length]);

  return <PixelSprite colors={frames[frameIndex] ?? frames[0]} />;
}

function PixelSprite({ colors }: { colors: string[] }) {
  const size = Math.max(1, Math.round(Math.sqrt(colors.length)));

  return (
    <div
      className="grid aspect-square w-full border border-zinc-950 bg-zinc-950"
      style={{
        backgroundImage: "conic-gradient(#6f6f6f 25%, #8b8b8b 0 50%, #6f6f6f 0 75%, #8b8b8b 0)",
        backgroundSize: "16px 16px",
        gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
      }}
    >
      {colors.map((color, index) => (
        <span key={index} style={{ backgroundColor: color }} />
      ))}
    </div>
  );
}

function Feature({ icon: Icon, text, title }: { icon: LucideIcon; text: string; title: string }) {
  return (
    <div className="border border-zinc-800 bg-zinc-950 p-5">
      <Icon className="mb-4 text-amber-300" size={22} />
      <h3 className="font-ui text-lg font-black text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{text}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, text, title }: { icon: LucideIcon; text: string; title: string }) {
  return (
    <div className="flex gap-3 border border-zinc-800 bg-zinc-900 p-4">
      <Icon className="mt-0.5 shrink-0 text-amber-300" size={18} />
      <div>
        <h3 className="font-ui text-sm font-black text-white">{title}</h3>
        <p className="mt-1 text-xs leading-5 text-zinc-400">{text}</p>
      </div>
    </div>
  );
}

const exampleSprites = [
  { name: "Knight", caption: "idle animation", frames: makeKnightFrames() },
  { name: "Mage", caption: "spell caster", frames: makeMageFrames() },
  { name: "Ship", caption: "arcade object", frames: makeShipFrames() },
  { name: "Chest", caption: "loot pickup", frames: makeChestFrames() },
  { name: "Dungeon", caption: "tile mockup", frames: makeDungeonFrames() },
  { name: "Flame", caption: "effect loop", frames: makeFlameFrames() },
];

type SpriteTools = {
  ellipse: (centerX: number, centerY: number, radiusX: number, radiusY: number, color: string) => void;
  rect: (x: number, y: number, width: number, height: number, color: string) => void;
  set: (x: number, y: number, color: string) => void;
};

function makeSprite(draw: (tools: SpriteTools) => void) {
  const size = 16;
  const pixels = Array.from({ length: size * size }).fill("transparent") as string[];
  const set = (x: number, y: number, color: string) => {
    if (x >= 0 && x < size && y >= 0 && y < size) {
      pixels[y * size + x] = color;
    }
  };
  const rect = (x: number, y: number, width: number, height: number, color: string) => {
    for (let yy = y; yy < y + height; yy += 1) {
      for (let xx = x; xx < x + width; xx += 1) {
        set(xx, yy, color);
      }
    }
  };
  const ellipse = (centerX: number, centerY: number, radiusX: number, radiusY: number, color: string) => {
    for (let y = Math.floor(centerY - radiusY); y <= Math.ceil(centerY + radiusY); y += 1) {
      for (let x = Math.floor(centerX - radiusX); x <= Math.ceil(centerX + radiusX); x += 1) {
        const dx = (x + 0.5 - centerX) / radiusX;
        const dy = (y + 0.5 - centerY) / radiusY;
        if (dx * dx + dy * dy <= 1) {
          set(x, y, color);
        }
      }
    }
  };

  draw({ ellipse, rect, set });
  return pixels;
}

function makeKnightFrames() {
  return [makeKnightFrame(0), makeKnightFrame(1)];
}

function makeKnightFrame(step: number) {
  return makeSprite(({ rect, set }) => {
    const bob = step % 2;
    rect(5, 2 + bob, 6, 1, "#c2c3c7");
    rect(4, 3 + bob, 8, 3, "#5f574f");
    rect(5, 4 + bob, 6, 2, "#c2c3c7");
    rect(6, 5 + bob, 1, 1, "#1d2b53");
    rect(9, 5 + bob, 1, 1, "#1d2b53");
    rect(6, 7 + bob, 4, 4, "#29adff");
    rect(5, 8 + bob, 1, 3, "#1d2b53");
    rect(10, 8 + bob, 1, 3, "#1d2b53");
    rect(11, 6 + bob, 1, 7, "#c2c3c7");
    rect(12, 5 + bob, 1, 1, "#ffffff");
    rect(5, 12, 2, 2, "#5f574f");
    rect(9, 12, 2, 2, "#5f574f");
    set(7, 3 + bob, "#ffffff");
    set(8, 3 + bob, "#ffffff");
  });
}

function makeMageFrames() {
  return [makeMageFrame(0), makeMageFrame(1)];
}

function makeMageFrame(step: number) {
  return makeSprite(({ rect, set }) => {
    rect(6, 1, 4, 2, "#7e2553");
    rect(5, 3, 6, 2, "#ff004d");
    rect(6, 5, 4, 2, "#ffccaa");
    rect(6, 7, 4, 6, "#7e2553");
    rect(5, 9, 1, 3, "#ff004d");
    rect(10, 9, 1, 3, "#ff004d");
    rect(4, 7, 1, 7, "#ab5236");
    rect(3, 5 + step, 2, 2, "#29adff");
    rect(3, 6 + step, 1, 1, "#ffffff");
    rect(6, 13, 2, 2, "#1d2b53");
    rect(9, 13, 2, 2, "#1d2b53");
    set(7, 6, "#1d2b53");
    set(9, 6, "#1d2b53");
  });
}

function makeShipFrames() {
  return [makeShipFrame(0), makeShipFrame(1)];
}

function makeShipFrame(step: number) {
  return makeSprite(({ rect, set }) => {
    rect(7, 2, 2, 2, "#ffffff");
    rect(6, 4, 4, 2, "#c2c3c7");
    rect(5, 6, 6, 3, "#29adff");
    rect(4, 8, 8, 3, "#1d2b53");
    rect(3, 9, 2, 3, "#ff004d");
    rect(11, 9, 2, 3, "#ff004d");
    rect(6, 7, 4, 1, "#ffffff");
    rect(6, 11, 4, 1, "#5f574f");
    rect(7, 12, 2, 1 + step, "#ffec27");
    rect(8, 13, 1, 2, "#ffb000");
    set(4, 7, "#c2c3c7");
    set(11, 7, "#c2c3c7");
  });
}

function makeChestFrames() {
  return [makeChestFrame(0), makeChestFrame(1)];
}

function makeChestFrame(open: number) {
  return makeSprite(({ rect }) => {
    rect(4, 5 - open, 8, 3, "#ab5236");
    rect(5, 6 - open, 6, 1, "#ffec27");
    rect(3, 8, 10, 5, "#5f574f");
    rect(4, 9, 8, 3, "#ab5236");
    rect(7, 9, 2, 3, "#ffec27");
    rect(3, 12, 10, 1, "#1d2b53");
    if (open) {
      rect(6, 4, 4, 2, "#ffec27");
      rect(7, 3, 2, 1, "#ffffff");
    }
  });
}

function makeDungeonFrames() {
  return [makeDungeonFrame(0), makeDungeonFrame(1)];
}

function makeDungeonFrame(step: number) {
  return makeSprite(({ rect, set }) => {
    rect(0, 0, 16, 16, "#1d2b53");
    rect(1, 1, 14, 14, "#5f574f");
    rect(2, 2, 4, 3, "#847e87");
    rect(10, 2, 4, 3, "#847e87");
    rect(5, 7, 6, 5, "#18181b");
    rect(6, 8, 4, 4, "#09090b");
    rect(7, 9, 2, 3, "#3f3f46");
    rect(2, 12, 3, 2, "#3f3f46");
    rect(11, 12, 3, 2, "#3f3f46");
    set(6, 6, step ? "#ffec27" : "#ffb000");
    set(9, 6, step ? "#ffb000" : "#ffec27");
  });
}

function makeFlameFrames() {
  return [makeFlameFrame(0), makeFlameFrame(1), makeFlameFrame(2)];
}

function makeFlameFrame(step: number) {
  return makeSprite(({ rect, set }) => {
    rect(6, 10, 5, 3, "#ab5236");
    rect(5, 7, 7, 4, "#ff004d");
    rect(6, 5 - (step % 2), 5, 5, "#ffb000");
    rect(7, 7, 3, 4, "#ffec27");
    rect(8, 8, 1, 2, "#ffffff");
    set(5 + step, 6, "#ff004d");
    set(10 - step, 5, "#ffec27");
    set(4, 10, "#ffb000");
    set(12, 9, "#ff004d");
  });
}

function createPreviewPixels() {
  const pixels = Array.from<Pixel>({ length: 32 * 32 }).fill(null);
  const set = (x: number, y: number, color: Pixel) => {
    if (x >= 0 && x < 32 && y >= 0 && y < 32) {
      pixels[y * 32 + x] = color;
    }
  };

  const fillRect = (x: number, y: number, width: number, height: number, color: Pixel) => {
    for (let yy = y; yy < y + height; yy += 1) {
      for (let xx = x; xx < x + width; xx += 1) {
        set(xx, yy, color);
      }
    }
  };

  const fillEllipse = (centerX: number, centerY: number, radiusX: number, radiusY: number, color: Pixel) => {
    for (let y = Math.floor(centerY - radiusY); y <= Math.ceil(centerY + radiusY); y += 1) {
      for (let x = Math.floor(centerX - radiusX); x <= Math.ceil(centerX + radiusX); x += 1) {
        const dx = (x + 0.5 - centerX) / radiusX;
        const dy = (y + 0.5 - centerY) / radiusY;
        if (dx * dx + dy * dy <= 1) {
          set(x, y, color);
        }
      }
    }
  };

  fillRect(10, 3, 12, 3, "#5f574f");
  fillRect(8, 6, 16, 7, "#1d2b53");
  fillRect(10, 7, 12, 5, "#c2c3c7");
  fillRect(12, 8, 2, 2, "#ffffff");
  fillRect(18, 8, 2, 2, "#ffffff");
  fillRect(12, 10, 2, 2, "#1d2b53");
  fillRect(18, 10, 2, 2, "#1d2b53");
  fillRect(14, 12, 5, 1, "#5f574f");
  fillRect(11, 15, 10, 9, "#29adff");
  fillRect(13, 16, 6, 7, "#1d2b53");
  fillRect(14, 17, 4, 5, "#ffec27");
  fillRect(7, 16, 4, 8, "#c2c3c7");
  fillRect(21, 16, 3, 8, "#5f574f");
  fillRect(24, 11, 2, 15, "#c2c3c7");
  fillRect(23, 10, 4, 2, "#ffffff");
  fillRect(6, 18, 4, 5, "#7e2553");
  fillRect(7, 19, 2, 3, "#ff004d");
  fillRect(10, 24, 5, 3, "#1d2b53");
  fillRect(17, 24, 5, 3, "#1d2b53");
  fillRect(9, 27, 6, 2, "#5f574f");
  fillRect(17, 27, 6, 2, "#5f574f");

  return pixels;
}
