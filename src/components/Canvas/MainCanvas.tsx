import { useEffect, useRef, useState } from "react";
import { usePixelCanvas } from "../../hooks/usePixelCanvas";
import { useCanvasTransform } from "../../hooks/useCanvasTransform";
import { CanvasPreview } from "./CanvasPreview";
import { Clipboard, Copy, FlipHorizontal2, FlipVertical2, LucideIcon, Move, Scissors, Trash2 } from "lucide-react";
import { Pixel } from "../../types";

type MainCanvasProps = {
  canvas: ReturnType<typeof usePixelCanvas>;
  transform: ReturnType<typeof useCanvasTransform>;
  onionSkinEnabled: boolean;
};

type PendingTouchDraw = {
  button: number;
  clientX: number;
  clientY: number;
  pointerId: number;
  shiftKey: boolean;
};

export function MainCanvas({ canvas, transform, onionSkinEnabled }: MainCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pendingTouchDrawRef = useRef<PendingTouchDraw | null>(null);
  const touchDrawingStartedRef = useRef(false);
  const maxDisplaySize = 512;
  const pixelSize = maxDisplaySize / Math.max(canvas.width, canvas.height);
  const displayWidth = Math.max(1, Math.round(canvas.width * pixelSize));
  const displayHeight = Math.max(1, Math.round(canvas.height * pixelSize));
  const isWideCanvas = canvas.width >= canvas.height;
  const [showPreview, setShowPreview] = useState(true);
  const [showOtherLayers, setShowOtherLayers] = useState(true);


  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");

    if (!context) {
      return;
    }

    // Clear the full display viewport area
    context.clearRect(0, 0, displayWidth, displayHeight);

    // 1. Draw a fixed-size checkerboard behind the artwork.
    const checkerSize = 8;
    for (let y = 0; y < displayHeight; y += checkerSize) {
      for (let x = 0; x < displayWidth; x += checkerSize) {
        context.fillStyle = (Math.floor(x / checkerSize) + Math.floor(y / checkerSize)) % 2 === 0 ? "#8b8b8b" : "#6f6f6f";
        context.fillRect(x, y, checkerSize, checkerSize);
      }
    }

    const drawPixel = (index: number, color: Pixel, alpha = 1) => {
      if (!color) {
        return;
      }

      const x = index % canvas.width;
      const y = Math.floor(index / canvas.width);

      const startX = Math.floor(x * pixelSize);
      const nextX = Math.floor((x + 1) * pixelSize);
      const drawWidth = nextX - startX;

      const startY = Math.floor(y * pixelSize);
      const nextY = Math.floor((y + 1) * pixelSize);
      const drawHeight = nextY - startY;

      context.globalAlpha = alpha;
      context.fillStyle = color;
      context.fillRect(startX, startY, drawWidth, drawHeight);
    };

    // 2. Draw the painted pixel colors.
    // Merged view draws every visible layer at full opacity.
    // Active-layer view merges inactive layers first, so overlapping references do not become darker.
    const currentFrame = canvas.frames.find((f) => f.id === canvas.activeFrameId) || canvas.frames[0];
    const mergeView = canvas.dimInactiveLayers;

    if (currentFrame) {
      if (mergeView) {
        canvas.layers.forEach((layer) => {
          if (!layer.visible) {
            return;
          }

          const resolved = canvas.getResolvedCel(currentFrame.id, layer.id);
          if (!resolved) {
            return;
          }

          resolved.cel.pixels.forEach((color, index) => drawPixel(index, color, 1));
        });
      } else {
        const inactivePixels = Array.from<Pixel>({ length: canvas.width * canvas.height }).fill(null);

        canvas.layers.forEach((layer) => {
          if (!layer.visible) {
            return;
          }

          const resolved = canvas.getResolvedCel(currentFrame.id, layer.id);
          if (!resolved) {
            return;
          }

          const isActive = layer.id === canvas.activeLayerId;
          if (isActive) {
            return;
          }

          if (!showOtherLayers) {
            return;
          }

          resolved.cel.pixels.forEach((color, index) => {
            if (color) {
              inactivePixels[index] = color;
            }
          });
        });

        inactivePixels.forEach((color, index) => drawPixel(index, color, 0.25));
        const activeLayer = canvas.layers.find((layer) => layer.id === canvas.activeLayerId && layer.visible);
        const activeResolved = activeLayer ? canvas.getResolvedCel(currentFrame.id, activeLayer.id) : null;
        if (activeResolved) {
          activeResolved.cel.pixels.forEach((color, index) => drawPixel(index, color, 1));
        }
      }
    }

    // 3. Draw onion skin on top if enabled
    if (onionSkinEnabled && canvas.onionSkinPixels) {
      canvas.onionSkinPixels.forEach((color, index) => {
        if (!color) {
          return;
        }
        const x = index % canvas.width;
        const y = Math.floor(index / canvas.width);

        const startX = Math.floor(x * pixelSize);
        const nextX = Math.floor((x + 1) * pixelSize);
        const drawWidth = nextX - startX;

        const startY = Math.floor(y * pixelSize);
        const nextY = Math.floor((y + 1) * pixelSize);
        const drawHeight = nextY - startY;

        // Draw the onion skin pixel color directly on top with transparency
        context.globalAlpha = 0.25; // Aligned with inactive layer opacity (25%) for consistency
        context.fillStyle = color;
        context.fillRect(startX, startY, drawWidth, drawHeight);
      });
    }

    // Restore globalAlpha to default
    context.globalAlpha = 1.0;
  }, [canvas.height, canvas.layers, canvas.activeLayerId, canvas.width, displayHeight, displayWidth, pixelSize, showOtherLayers, onionSkinEnabled, canvas.onionSkinPixels, canvas.frames, canvas.getResolvedCel, canvas.dimInactiveLayers, canvas.activeFrameId]);


  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      transform.handleWheel(event, rect);
    }
  };

  const toTransformEvent = (event: React.PointerEvent<HTMLCanvasElement>) =>
    event as unknown as React.PointerEvent<HTMLDivElement>;

  const getContainerRect = () => containerRef.current?.getBoundingClientRect();

  const toCanvasPointerEvent = (
    event: PendingTouchDraw | React.PointerEvent<HTMLCanvasElement>,
  ) =>
    ({
      button: event.button,
      clientX: event.clientX,
      clientY: event.clientY,
      currentTarget: canvasRef.current,
      pointerId: event.pointerId,
      shiftKey: event.shiftKey,
    } as unknown as React.PointerEvent<HTMLCanvasElement>);

  const cancelPendingTouchDraw = () => {
    pendingTouchDrawRef.current = null;
    touchDrawingStartedRef.current = false;
  };

  const startPendingTouchDraw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pendingTouchDrawRef.current || touchDrawingStartedRef.current || !canvasRef.current) {
      return;
    }

    canvas.handlePointerDown(toCanvasPointerEvent(pendingTouchDrawRef.current));
    touchDrawingStartedRef.current = true;
    canvas.handlePointerMove(event);
  };

  const blockCanvasTouchEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType !== "touch") {
      return false;
    }

    transform.handlePointerDown(toTransformEvent(event), getContainerRect());

    if (!transform.shouldBlockTouchDrawing()) {
      return false;
    }

    cancelPendingTouchDraw();
    canvas.handlePointerUp(event);
    event.preventDefault();
    event.stopPropagation();
    return true;
  };

  const handleCanvasPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (blockCanvasTouchEvent(event)) {
      return;
    }

    if (event.pointerType === "touch") {
      pendingTouchDrawRef.current = {
        button: event.button,
        clientX: event.clientX,
        clientY: event.clientY,
        pointerId: event.pointerId,
        shiftKey: event.shiftKey,
      };
      touchDrawingStartedRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    canvas.handlePointerDown(event);
  };

  const handleCanvasPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "touch" && transform.shouldBlockTouchDrawing()) {
      transform.handlePointerMove(toTransformEvent(event), getContainerRect());
      cancelPendingTouchDraw();
      canvas.handlePointerUp(event);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.pointerType === "touch") {
      const pending = pendingTouchDrawRef.current;
      if (pending && pending.pointerId === event.pointerId && !touchDrawingStartedRef.current) {
        const distance = Math.hypot(event.clientX - pending.clientX, event.clientY - pending.clientY);
        if (distance >= 4) {
          startPendingTouchDraw(event);
        }
      } else if (touchDrawingStartedRef.current) {
        canvas.handlePointerMove(event);
      }

      event.preventDefault();
      event.stopPropagation();
      return;
    }

    canvas.handlePointerMove(event);
  };

  const handleCanvasPointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType === "touch" && transform.shouldBlockTouchDrawing()) {
      transform.handlePointerUp(toTransformEvent(event));
      cancelPendingTouchDraw();
      canvas.handlePointerUp(event);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.pointerType === "touch") {
      transform.handlePointerUp(toTransformEvent(event));
      if (pendingTouchDrawRef.current && pendingTouchDrawRef.current.pointerId === event.pointerId && !touchDrawingStartedRef.current) {
        canvas.handlePointerDown(toCanvasPointerEvent(pendingTouchDrawRef.current));
      }
      canvas.handlePointerUp(event);
      cancelPendingTouchDraw();
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    canvas.handlePointerUp(event);
  };

  const isTransforming = transform.isSpacePressed || transform.isPanning || transform.isTouchGestureActive;

  useEffect(() => {
    if (canvas.activeTool !== "selection" || !canvas.selectionRect) {
      return;
    }

    const handleDocumentPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (canvasRef.current?.contains(target)) {
        return;
      }

      if (target.closest("[data-selection-toolbar]")) {
        return;
      }

      canvas.clearSelection();
    };

    document.addEventListener("pointerdown", handleDocumentPointerDown);
    return () => document.removeEventListener("pointerdown", handleDocumentPointerDown);
  }, [canvas]);

  return (
    <section
      ref={containerRef}
      className={`relative min-w-0 flex-1 touch-none overflow-hidden overscroll-contain bg-zinc-950 select-none ${
        transform.isSpacePressed ? "cursor-grab" : ""
      } ${transform.isPanning ? "cursor-grabbing" : ""}`}
      onWheel={handleWheel}
      onPointerDown={transform.handlePointerDown}
      onPointerMove={transform.handlePointerMove}
      onPointerCancel={transform.handlePointerUp}
      onPointerUp={transform.handlePointerUp}
      onContextMenu={(event) => event.preventDefault()}
      onSelect={(event) => event.preventDefault()}
      onSelectCapture={(event) => event.preventDefault()}
    >
      <div className="absolute inset-0 pixel-grid opacity-40 pointer-events-none" />

      {/* Active Layer Indicator + Merged View Toggle */}
      <div className="pointer-events-none absolute left-4 top-4 z-20 hidden flex-col gap-1.5 md:flex">
        <div className="border border-zinc-800 bg-zinc-900/95 px-2.5 py-1 font-ui text-[11px] font-semibold text-zinc-400 shadow-pixel select-none backdrop-blur-[2px]">
          Active: <span className="text-amber-300 font-bold">{canvas.layers.find(l => l.id === canvas.activeLayerId)?.name || "Layer"}</span>
        </div>
        {/* Merged view toggle */}
        <button
          type="button"
          className={`pointer-events-auto border px-2.5 py-1 font-ui text-[11px] font-semibold shadow-pixel select-none transition-all min-w-[104px] text-center md:min-w-[112px] ${
            canvas.dimInactiveLayers
              ? "border-amber-300 bg-amber-300/10 text-amber-300"
              : "border-zinc-700 bg-zinc-900/95 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500"
          }`}
          onClick={() => canvas.setDimInactiveLayers(!canvas.dimInactiveLayers)}
          title={canvas.dimInactiveLayers ? "Merged View" : "Active Layer"}
        >
          {canvas.dimInactiveLayers ? "Merged View" : "Active Layer"}
        </button>
      </div>

      {/* Right Floating Control Sidebar (Preview + Layers) */}
      <div className="pointer-events-none absolute right-4 top-4 z-20 hidden w-[176px] flex-col gap-3 md:flex">
        {/* Preview Widget */}
        {showPreview ? (
          <div className="pointer-events-auto">
            <CanvasPreview
              frames={canvas.frames}
              layers={canvas.layers}
              activeFrameId={canvas.activeFrameId}
              isPlaying={canvas.isPlaying}
              fps={canvas.fps}
              width={canvas.width}
              height={canvas.height}
              onClose={() => setShowPreview(false)}
              getResolvedCel={canvas.getResolvedCel}
            />
          </div>
        ) : (
          <div className="pointer-events-auto">
            <button
              onClick={() => setShowPreview(true)}
              className="border border-zinc-950 bg-zinc-800 px-3 py-1.5 font-pixel text-[11px] text-zinc-300 shadow-pixel hover:bg-zinc-700 hover:text-white w-full"
              type="button"
            >
              Preview
            </button>
          </div>
        )}
      </div>

      {canvas.selectionRect ? (
        <div
          data-selection-toolbar
          className="absolute left-1/2 top-16 z-40 flex -translate-x-1/2 items-center gap-1 border border-zinc-950 bg-zinc-900/95 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-[2px]"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerMove={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <SelectionButton icon={Copy} label="Copy" onClick={canvas.copySelection} disabled={!canvas.selectionRect} />
          <SelectionButton icon={Scissors} label="Cut" onClick={canvas.cutSelection} disabled={!canvas.selectionRect} />
          <SelectionButton icon={Clipboard} label="Paste" onClick={canvas.pasteSelection} disabled={!canvas.hasCopiedSelection} />
          <SelectionButton
            active={canvas.selectionMoveContentsMode}
            icon={Move}
            label={canvas.selectionMoveContentsMode ? "Move pixels with selection: on" : "Move pixels with selection: off"}
            onClick={() => canvas.setSelectionMoveContentsMode(!canvas.selectionMoveContentsMode)}
          />
          <SelectionButton icon={FlipHorizontal2} label="Flip horizontal" onClick={() => canvas.flipSelection("horizontal")} disabled={!canvas.selectionRect} />
          <SelectionButton icon={FlipVertical2} label="Flip vertical" onClick={() => canvas.flipSelection("vertical")} disabled={!canvas.selectionRect} />
          <SelectionButton icon={Trash2} label="Delete" danger onClick={canvas.deleteSelection} disabled={!canvas.selectionRect} />
        </div>
      ) : null}

      {/* Zoom / Pan container wrapper */}
      <div
        className={`absolute flex items-center justify-center ${
          isTransforming ? "" : "transition-transform duration-75 ease-out"
        }`}
        style={{
          transform: `translate(calc(-50% + ${transform.panX}px), calc(-50% + ${transform.panY}px)) scale(${transform.zoom})`,
          transformOrigin: "center",
          backfaceVisibility: "hidden",
          left: "50%",
          top: "50%",
          willChange: "transform",
          aspectRatio: `${canvas.width} / ${canvas.height}`,
          ...(isWideCanvas
            ? { width: "min(calc(100% - 24px), 544px)" }
            : { height: "min(calc(100% - 24px), calc(100dvh - 260px), 544px)" }),
          maxHeight: "calc(100dvh - 260px)",
          maxWidth: "calc(100% - 24px)",
          minWidth: "160px",
        }}
      >
        <div className="h-full w-full border border-zinc-950 bg-zinc-800 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.45)] md:p-4">
          <div className="relative h-full w-full border-4 border-zinc-950 bg-zinc-950">
            {!isTransforming &&
              canvas.hoverPoints.map((point) => (
                <div
                  className="pointer-events-none absolute left-0 top-0 z-20 bg-zinc-500 opacity-50"
                  key={`${point.x},${point.y}`}
                  style={{
                    height: `${100 / canvas.height}%`,
                    left: `${(point.x / canvas.width) * 100}%`,
                    top: `${(point.y / canvas.height) * 100}%`,
                    width: `${100 / canvas.width}%`,
                  }}
                />
              ))}
            {!isTransforming && canvas.selectionRect ? (
              <>
                {canvas.copiedSelectionStamp?.pixels.map((color, index) => {
                  if (!color || !canvas.selectionRect || !canvas.copiedSelectionStamp) {
                    return null;
                  }

                  const localX = index % canvas.copiedSelectionStamp.width;
                  const localY = Math.floor(index / canvas.copiedSelectionStamp.width);
                  const targetX = canvas.selectionRect.x + localX;
                  const targetY = canvas.selectionRect.y + localY;

                  if (targetX < 0 || targetX >= canvas.width || targetY < 0 || targetY >= canvas.height) {
                    return null;
                  }

                  return (
                    <div
                      className="pointer-events-none absolute z-30 opacity-45 mix-blend-multiply"
                      key={`${targetX},${targetY},${index}`}
                      style={{
                        backgroundColor: color,
                        height: `${100 / canvas.height}%`,
                        left: `${(targetX / canvas.width) * 100}%`,
                        top: `${(targetY / canvas.height) * 100}%`,
                        width: `${100 / canvas.width}%`,
                      }}
                    />
                  );
                })}
                <div
                  className="pointer-events-none absolute z-30 border border-dashed border-amber-300 bg-amber-300/10 shadow-[0_0_0_1px_rgba(24,24,27,0.65),inset_0_0_0_1px_rgba(24,24,27,0.65)]"
                  style={{
                    height: `${(canvas.selectionRect.height / canvas.height) * 100}%`,
                    left: `${(canvas.selectionRect.x / canvas.width) * 100}%`,
                    top: `${(canvas.selectionRect.y / canvas.height) * 100}%`,
                    width: `${(canvas.selectionRect.width / canvas.width) * 100}%`,
                  }}
                />
              </>
            ) : null}
            <canvas
              className={`pixelated relative z-10 h-full w-full touch-none ${
                isTransforming ? "pointer-events-none" : "cursor-crosshair"
              }`}
              height={displayHeight}
              onContextMenu={canvas.handleContextMenu}
              onPointerCancel={handleCanvasPointerUp}
              onPointerDown={handleCanvasPointerDown}
              onPointerLeave={canvas.handlePointerLeave}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              ref={canvasRef}
              width={displayWidth}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function SelectionButton({
  active,
  danger,
  disabled,
  icon: Icon,
  label,
  onClick,
}: {
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`grid h-7 w-7 place-items-center border border-zinc-950 shadow-pixel disabled:cursor-not-allowed disabled:opacity-35 ${
        active ? "bg-amber-300 text-zinc-950" : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
      } ${
        danger ? "hover:text-red-300" : active ? "" : "hover:text-amber-300"
      }`}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon size={14} strokeWidth={2.25} />
    </button>
  );
}
