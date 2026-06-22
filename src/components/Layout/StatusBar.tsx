import { PixelPoint, Tool } from "../../types";

type StatusBarProps = {
  canvasSize: string;
  cursorPoint: PixelPoint | null;
  tool: Tool;
  zoom: string;
};

const toolLabels: Record<Tool, string> = {
  bucket: "Bucket",
  eraser: "Eraser",
  eyedropper: "Eyedropper",
  pencil: "Pencil",
};

export function StatusBar({ canvasSize, cursorPoint, tool, zoom }: StatusBarProps) {
  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-zinc-950 bg-zinc-800 px-3 font-ui text-[11px] text-zinc-300">
      <div className="flex items-center gap-4">
        <span>Tool: {toolLabels[tool]}</span>
        <span>
          X: {cursorPoint ? cursorPoint.x.toString().padStart(2, "0") : "--"} Y:{" "}
          {cursorPoint ? cursorPoint.y.toString().padStart(2, "0") : "--"}
        </span>
        <span>Canvas: {canvasSize}</span>
        <span>Zoom: {zoom}</span>
      </div>
      <div className="text-zinc-500">Ready</div>
    </footer>
  );
}
