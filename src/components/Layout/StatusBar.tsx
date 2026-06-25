import { PixelPoint, Tool } from "../../types";
import { Language, copy } from "../../i18n";

type StatusBarProps = {
  canvasSize: string;
  cursorPoint: PixelPoint | null;
  language: Language;
  tool: Tool;
  zoom: string;
};

const toolLabels: Record<Language, Record<Tool, string>> = {
  en: {
    bucket: "Bucket",
    darken: "Darken",
    ellipse: "Ellipse",
    eraser: "Eraser",
    eyedropper: "Eyedropper",
    lighten: "Lighten",
    line: "Line",
    pencil: "Pencil",
    rectangle: "Rectangle",
    selection: "Selection",
  },
  ko: {
    bucket: "채우기",
    darken: "어둡게",
    ellipse: "타원",
    eraser: "지우개",
    eyedropper: "스포이드",
    lighten: "밝게",
    line: "선",
    pencil: "연필",
    rectangle: "사각형",
    selection: "선택",
  },
};

export function StatusBar({ canvasSize, cursorPoint, language, tool, zoom }: StatusBarProps) {
  const t = copy[language];

  return (
    <footer className="flex h-7 shrink-0 items-center justify-between overflow-x-auto border-t border-zinc-950 bg-zinc-800 px-3 font-ui text-[11px] text-zinc-300 scrollbar-none">
      <div className="flex min-w-max items-center gap-4">
        <span>{t.tool}: {toolLabels[language][tool]}</span>
        <span>
          X: {cursorPoint ? cursorPoint.x.toString().padStart(2, "0") : "--"} Y:{" "}
          {cursorPoint ? cursorPoint.y.toString().padStart(2, "0") : "--"}
        </span>
        <span>{t.canvas}: {canvasSize}</span>
        <span>{t.zoom}: {zoom}</span>
      </div>
      <div className="hidden gap-3 text-zinc-400 md:flex">
        <a href="/guide.html" target="_blank" rel="noopener noreferrer" className="hover:text-amber-300 transition-colors">{t.guideFaq}</a>
        <span className="text-zinc-600">|</span>
        <a href="/about.html" target="_blank" rel="noopener noreferrer" className="hover:text-amber-300 transition-colors">{t.aboutContact}</a>
        <span className="text-zinc-600">|</span>
        <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-amber-300 transition-colors">{t.privacyPolicy}</a>
        <span className="text-zinc-600">|</span>
        <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="hover:text-amber-300 transition-colors">{t.termsService}</a>
      </div>
    </footer>
  );
}
