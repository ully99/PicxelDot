import { useState } from "react";
import { ColorPalette } from "./components/Panels/ColorPalette";
import { Toolbar } from "./components/Panels/Toolbar";
import { MainCanvas } from "./components/Canvas/MainCanvas";
import { HeaderMenu } from "./components/Layout/HeaderMenu";
import { TimelinePanel } from "./components/Panels/TimelinePanel";
import { StatusBar } from "./components/Layout/StatusBar";
import { AdBanner } from "./components/Layout/AdBanner";
import { ToolOptionsBar } from "./components/Layout/ToolOptionsBar";
import { usePixelCanvas } from "./hooks/usePixelCanvas";
import { useCanvasTransform } from "./hooks/useCanvasTransform";

export default function App() {
  const pixelCanvas = usePixelCanvas();
  const canvasTransform = useCanvasTransform(1);
  const [onionSkinEnabled, setOnionSkinEnabled] = useState(true);

  return (
    <div className="flex h-dvh min-h-[640px] flex-col overflow-hidden bg-zinc-950 text-zinc-100">
      <HeaderMenu canvas={pixelCanvas} />
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
        onUndo={pixelCanvas.undo}
        opacity={pixelCanvas.opacity}
      />

      <main className="grid min-h-0 flex-1 grid-cols-[232px_minmax(0,1fr)_76px] border-y border-zinc-950 bg-zinc-900">
        <ColorPalette
          background={pixelCanvas.background}
          foreground={pixelCanvas.foreground}
          onSelectBackground={pixelCanvas.setBackground}
          onSelectForeground={pixelCanvas.setForeground}
        />
        <div className="relative flex flex-col min-w-0 flex-1">
          <MainCanvas
            canvas={pixelCanvas}
            transform={canvasTransform}
            onionSkinEnabled={onionSkinEnabled}
          />
          <TimelinePanel
            canvas={pixelCanvas}
            onionSkinEnabled={onionSkinEnabled}
            onTogglePreviousFrame={() => setOnionSkinEnabled((prev) => !prev)}
          />
        </div>
        <Toolbar
          activeTool={pixelCanvas.activeTool}
          onSelectTool={pixelCanvas.setActiveTool}
        />
      </main>

      <StatusBar
        canvasSize={`${pixelCanvas.width} x ${pixelCanvas.height}`}
        cursorPoint={pixelCanvas.cursorPoint}
        tool={pixelCanvas.activeTool}
        zoom={`${Math.round(canvasTransform.zoom * 100)}%`}
      />
      <AdBanner />
    </div>
  );
}

