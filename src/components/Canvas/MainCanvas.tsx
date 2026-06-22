import { useEffect, useRef, useState } from "react";
import { usePixelCanvas } from "../../hooks/usePixelCanvas";
import { useCanvasTransform } from "../../hooks/useCanvasTransform";
import { CanvasPreview } from "./CanvasPreview";
import { LayerPanel } from "../Panels/LayerPanel";

type MainCanvasProps = {
  canvas: ReturnType<typeof usePixelCanvas>;
  transform: ReturnType<typeof useCanvasTransform>;
  onionSkinEnabled: boolean;
};

export function MainCanvas({ canvas, transform, onionSkinEnabled }: MainCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displaySize = 512;
  const cellSize = displaySize / canvas.width;
  const [showPreview, setShowPreview] = useState(true);
  const [showOtherLayers, setShowOtherLayers] = useState(true);


  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");

    if (!context) {
      return;
    }

    // Clear the full display viewport area
    context.clearRect(0, 0, displaySize, displaySize);

    // 1. Draw the checkerboard background directly onto the canvas first
    const cols = canvas.width;
    const rows = canvas.height;

    for (let y = 0; y < rows; y += 1) {
      const startY = Math.floor(y * cellSize);
      const nextY = Math.floor((y + 1) * cellSize);
      const drawHeight = nextY - startY;

      for (let x = 0; x < cols; x += 1) {
        const startX = Math.floor(x * cellSize);
        const nextX = Math.floor((x + 1) * cellSize);
        const drawWidth = nextX - startX;

        context.fillStyle = (x + y) % 2 === 0 ? "#ffffff" : "#eaeaea";
        context.fillRect(startX, startY, drawWidth, drawHeight);
      }
    }

    // 2. Draw the painted pixel colors layer by layer
    // dimInactiveLayers=true 이면 모든 레이어를 100% 불투명도로 병합해서 표시
    // dimInactiveLayers=false 이면 비활성 레이어를 25% 투명도로 표시
    const currentFrame = canvas.frames.find((f) => f.id === canvas.activeFrameId) || canvas.frames[0];
    const mergeView = canvas.dimInactiveLayers;

    if (currentFrame) {
      canvas.layers.forEach((layer) => {
        if (!layer.visible) {
          return;
        }

        const isActive = layer.id === canvas.activeLayerId;
        if (!showOtherLayers && !isActive && !mergeView) {
          return;
        }

        const resolved = canvas.getResolvedCel(currentFrame.id, layer.id);
        if (!resolved) {
          return;
        }
        const cel = resolved.cel;

        cel.pixels.forEach((color, index) => {
          if (!color) {
            return;
          }

          const x = index % canvas.width;
          const y = Math.floor(index / canvas.width);

          const startX = Math.floor(x * cellSize);
          const nextX = Math.floor((x + 1) * cellSize);
          const drawWidth = nextX - startX;

          const startY = Math.floor(y * cellSize);
          const nextY = Math.floor((y + 1) * cellSize);
          const drawHeight = nextY - startY;

          if (mergeView) {
            // 병합 뷰: 모든 레이어 100% 불투명도로 그리기
            context.globalAlpha = 1.0;
            context.fillStyle = color;
            context.fillRect(startX, startY, drawWidth, drawHeight);
          } else {
            // 일반 뷰: 비활성 레이어는 25% 투명도
            if (!isActive) {
              context.globalAlpha = 1.0;
              context.fillStyle = "#ffffff";
              context.fillRect(startX, startY, drawWidth, drawHeight);
            }
            context.globalAlpha = isActive ? 1.0 : 0.25;
            context.fillStyle = color;
            context.fillRect(startX, startY, drawWidth, drawHeight);
          }
        });
      });
    }

    // 3. Draw onion skin on top if enabled
    if (onionSkinEnabled && canvas.onionSkinPixels) {
      canvas.onionSkinPixels.forEach((color, index) => {
        if (!color) {
          return;
        }
        const x = index % canvas.width;
        const y = Math.floor(index / canvas.width);

        const startX = Math.floor(x * cellSize);
        const nextX = Math.floor((x + 1) * cellSize);
        const drawWidth = nextX - startX;

        const startY = Math.floor(y * cellSize);
        const nextY = Math.floor((y + 1) * cellSize);
        const drawHeight = nextY - startY;

        // Draw the onion skin pixel color directly on top with transparency
        context.globalAlpha = 0.25; // Aligned with inactive layer opacity (25%) for consistency
        context.fillStyle = color;
        context.fillRect(startX, startY, drawWidth, drawHeight);
      });
    }

    // Restore globalAlpha to default
    context.globalAlpha = 1.0;
  }, [canvas.height, canvas.layers, canvas.activeLayerId, canvas.width, cellSize, displaySize, showOtherLayers, onionSkinEnabled, canvas.onionSkinPixels, canvas.frames, canvas.getResolvedCel, canvas.dimInactiveLayers, canvas.activeFrameId]);


  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      transform.handleWheel(event, rect);
    }
  };

  const isTransforming = transform.isSpacePressed || transform.isPanning;

  return (
    <section
      ref={containerRef}
      className={`relative min-w-0 flex-1 overflow-hidden bg-zinc-950 select-none ${
        transform.isSpacePressed ? "cursor-grab" : ""
      } ${transform.isPanning ? "cursor-grabbing" : ""}`}
      onWheel={handleWheel}
      onPointerDown={transform.handlePointerDown}
      onPointerMove={transform.handlePointerMove}
      onPointerUp={transform.handlePointerUp}
    >
      <div className="absolute inset-0 pixel-grid opacity-40 pointer-events-none" />

      {/* Active Layer Indicator + Merged View Toggle */}
      <div className="pointer-events-none absolute left-4 top-4 z-20 flex flex-col gap-1.5">
        <div className="border border-zinc-800 bg-zinc-900/95 px-2.5 py-1 font-ui text-[11px] font-semibold text-zinc-400 shadow-pixel select-none backdrop-blur-[2px]">
          Active: <span className="text-amber-300 font-bold">{canvas.layers.find(l => l.id === canvas.activeLayerId)?.name || "Layer"}</span>
        </div>
        {/* 병합 뷰 토글 버튼 */}
        <button
          type="button"
          className={`pointer-events-auto border px-2.5 py-1 font-ui text-[11px] font-semibold shadow-pixel select-none transition-all min-w-[112px] text-center ${
            canvas.dimInactiveLayers
              ? "border-amber-300 bg-amber-300/10 text-amber-300"
              : "border-zinc-700 bg-zinc-900/95 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500"
          }`}
          onClick={() => canvas.setDimInactiveLayers(!canvas.dimInactiveLayers)}
          title={canvas.dimInactiveLayers ? "Merged View ON – Click to show active layer only" : "Merged View OFF – Click to merge all layers"}
        >
          {canvas.dimInactiveLayers ? "⊞ Merged View" : "⊟ Active Layer"}
        </button>
      </div>

      {/* Right Floating Control Sidebar (Preview + Layers) */}
      <div className="pointer-events-none absolute right-4 top-4 z-20 flex w-[176px] flex-col gap-3">
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

      {/* Zoom / Pan container wrapper */}
      <div
        className="absolute flex items-center justify-center p-8 transition-transform duration-75 ease-out"
        style={{
          transform: `translate(${transform.panX}px, ${transform.panY}px) scale(${transform.zoom})`,
          transformOrigin: "center",
          left: "calc(50% - 256px - 16px)",
          top: "calc(50% - 256px - 16px)",
          width: "544px",
          height: "544px",
        }}
      >
        <div className="border border-zinc-950 bg-zinc-800 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
          <div className="relative box-content h-[512px] w-[512px] border-4 border-zinc-950 bg-zinc-950">
            {!isTransforming &&
              canvas.hoverPoints.map((point) => (
                <div
                  className="pointer-events-none absolute left-0 top-0 z-20 bg-zinc-500 opacity-50"
                  key={`${point.x},${point.y}`}
                  style={{
                    height: `${cellSize}px`,
                    transform: `translate(${point.x * cellSize}px, ${point.y * cellSize}px)`,
                    width: `${cellSize}px`,
                  }}
                />
              ))}
            <canvas
              className={`pixelated relative z-10 h-full w-full ${
                isTransforming ? "pointer-events-none" : "cursor-crosshair"
              }`}
              height={displaySize}
              onContextMenu={canvas.handleContextMenu}
              onPointerCancel={canvas.handlePointerUp}
              onPointerDown={canvas.handlePointerDown}
              onPointerLeave={canvas.handlePointerLeave}
              onPointerMove={canvas.handlePointerMove}
              onPointerUp={canvas.handlePointerUp}
              ref={canvasRef}
              width={displaySize}
            />
          </div>
        </div>
      </div>
    </section>
  );
}




