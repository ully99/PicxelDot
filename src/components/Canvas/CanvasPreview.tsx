import { useEffect, useRef, useState } from "react";
import { Pixel, Frame, Layer, Cel } from "../../types";

type CanvasPreviewProps = {
  compact?: boolean;
  fullscreen?: boolean;
  frames: Frame[];
  layers: Layer[];
  activeFrameId: string;
  isPlaying: boolean;
  fps: number;
  width: number;
  height: number;
  onClose: () => void;
  getResolvedCel?: (frameId: string, layerId: string) => { frameId: string; cel: Cel } | null;
};

export function CanvasPreview({
  compact = false,
  fullscreen = false,
  frames,
  layers,
  activeFrameId,
  isPlaying,
  fps,
  width,
  height,
  onClose,
  getResolvedCel,
}: CanvasPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = useState(2);
  const [playIndex, setPlayIndex] = useState(0);

  useEffect(() => {
    if (!isPlaying) {
      const index = frames.findIndex((frame) => frame.id === activeFrameId);
      if (index !== -1) {
        setPlayIndex(index);
      }
    }
  }, [isPlaying, activeFrameId, frames]);

  useEffect(() => {
    if (!isPlaying || frames.length <= 1) {
      return;
    }

    const timer = setInterval(() => {
      setPlayIndex((current) => (current + 1) % frames.length);
    }, 1000 / fps);

    return () => clearInterval(timer);
  }, [isPlaying, frames.length, fps]);

  const getCombinedPixelsForFrame = (frame: Frame): Pixel[] => {
    const combined = Array.from<Pixel>({ length: width * height }).fill(null);
    layers.forEach((layer) => {
      if (!layer.visible) {
        return;
      }

      const resolved = getResolvedCel?.(frame.id, layer.id);
      const celPixels = resolved?.cel.pixels ?? frame.cels.find((cel) => cel.layerId === layer.id)?.pixels;
      if (!celPixels) {
        return;
      }

      celPixels.forEach((color, index) => {
        if (color) {
          combined[index] = color;
        }
      });
    });
    return combined;
  };

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, width, height);
    const currentFrame = frames[playIndex] || frames[0];
    if (!currentFrame) {
      return;
    }

    const pixels = getCombinedPixelsForFrame(currentFrame);
    pixels.forEach((color, index) => {
      if (!color) {
        return;
      }
      context.fillStyle = color;
      context.fillRect(index % width, Math.floor(index / width), 1, 1);
    });
  }, [frames, layers, playIndex, width, height, getResolvedCel]);

  return (
    <div
      className={`flex w-full flex-col border border-zinc-950 bg-zinc-900/90 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-[2px] ${
        compact ? "p-1.5" : fullscreen ? "h-full p-3" : "p-2"
      }`}
    >
      <div
        className={`flex items-center justify-between border-b border-zinc-950 font-pixel text-[11px] uppercase text-zinc-300 select-none ${
          compact ? "mb-1 pb-1" : "mb-2 pb-1.5"
        }`}
      >
        <span className="tracking-wider text-amber-300">Preview {isPlaying ? "Play" : ""}</span>
        <button
          className="grid h-5 w-5 place-items-center border border-zinc-950 bg-zinc-700 font-ui text-[10px] text-zinc-200 hover:bg-zinc-600 active:bg-zinc-950"
          onClick={onClose}
          title="Close Preview"
          type="button"
        >
          x
        </button>
      </div>

      <div
        className={`canvas-checker relative flex w-full items-center justify-center overflow-hidden border border-zinc-950 bg-zinc-950 ${
          compact ? "h-20" : fullscreen ? "min-h-0 flex-1" : "h-[120px]"
      }`}
      >
        <canvas
          className="pixelated"
          height={height}
          ref={canvasRef}
          style={
            fullscreen
              ? {
                  aspectRatio: `${width} / ${height}`,
                  height: "min(100%, 82vw)",
                  maxWidth: "100%",
                  width: "auto",
                }
              : {
                  height: `${height * scale}px`,
                  width: `${width * scale}px`,
                }
          }
          width={width}
        />
      </div>

      <div className={`flex items-center justify-between font-ui text-[10px] text-zinc-400 ${
        compact ? "mt-1" : "mt-2"
      }`}>
        <span>Zoom: {scale}x</span>
        <div className="flex gap-1">
          {[1, 2, 4].map((nextScale) => (
            <button
              className={`h-5 border px-1.5 font-semibold ${
                scale === nextScale
                  ? "border-amber-300 bg-amber-300/10 text-amber-300"
                  : "border-zinc-950 bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
              key={nextScale}
              onClick={() => setScale(nextScale)}
              type="button"
            >
              {nextScale}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
