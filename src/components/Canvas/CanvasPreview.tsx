import { useEffect, useRef, useState } from "react";
import { Pixel, Frame, Layer, Cel } from "../../types";

type CanvasPreviewProps = {
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
  const [scale, setScale] = useState(2); // 기본 2x 배율
  const [playIndex, setPlayIndex] = useState(0);

  // Sync playIndex with manual activeFrameId when not playing
  useEffect(() => {
    if (!isPlaying) {
      const index = frames.findIndex((f) => f.id === activeFrameId);
      if (index !== -1) {
        setPlayIndex(index);
      }
    }
  }, [isPlaying, activeFrameId, frames]);

  // Frame tick timer for animation playback
  useEffect(() => {
    if (!isPlaying || frames.length <= 1) {
      return;
    }

    const interval = 1000 / fps;
    const timer = setInterval(() => {
      setPlayIndex((current) => (current + 1) % frames.length);
    }, interval);

    return () => clearInterval(timer);
  }, [isPlaying, frames.length, fps]);

  // Merge cels of a specific frame matching visible layers to get flat pixel data
  const getCombinedPixelsForFrame = (frame: Frame): Pixel[] => {
    const combined = Array.from<Pixel>({ length: width * height }).fill(null);
    layers.forEach((layer) => {
      if (!layer.visible) {
        return;
      }
      
      let pixelsToUse: Pixel[] = [];
      if (getResolvedCel) {
        const resolved = getResolvedCel(frame.id, layer.id);
        if (resolved) {
          pixelsToUse = resolved.cel.pixels;
        }
      } else {
        const cel = frame.cels.find((c) => c.layerId === layer.id);
        if (cel) {
          pixelsToUse = cel.pixels;
        }
      }

      pixelsToUse.forEach((color, index) => {
        if (color) {
          combined[index] = color;
        }
      });
    });
    return combined;
  };

  // Render loop
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
  }, [frames, playIndex, width, height]);

  return (
    <div className="flex w-full flex-col border border-zinc-950 bg-zinc-900/90 p-2 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-[2px]">
      {/* Title Bar */}
      <div className="mb-2 flex items-center justify-between border-b border-zinc-950 pb-1.5 font-pixel text-[11px] text-zinc-300 uppercase select-none">
        <span className="text-amber-300 tracking-wider">Preview {isPlaying ? "• Play" : ""}</span>
        <button
          className="grid h-5 w-5 place-items-center border border-zinc-950 bg-zinc-700 font-ui text-[10px] text-zinc-200 hover:bg-zinc-600 active:bg-zinc-950"
          onClick={onClose}
          title="Close Preview"
          type="button"
        >
          x
        </button>
      </div>

      {/* Mini Canvas Container */}
      <div className="canvas-checker relative flex h-[120px] w-full items-center justify-center border border-zinc-950 bg-zinc-950 overflow-hidden">
        <canvas
          className="pixelated"
          height={height}
          ref={canvasRef}
          style={{
            height: `${height * scale}px`,
            width: `${width * scale}px`,
          }}
          width={width}
        />
      </div>

      {/* Controls Bar */}
      <div className="mt-2 flex items-center justify-between font-ui text-[10px] text-zinc-400">
        <span>Zoom: {scale}x</span>
        <div className="flex gap-1">
          {[1, 2, 4].map((s) => (
            <button
              className={`h-5 px-1.5 border font-semibold ${
                scale === s
                  ? "border-amber-300 bg-amber-300/10 text-amber-300"
                  : "border-zinc-950 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
              }`}
              key={s}
              onClick={() => setScale(s)}
              type="button"
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

