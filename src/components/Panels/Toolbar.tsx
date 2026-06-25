import { useRef, useState } from "react";
import { ChevronRight, Circle, Eraser, LucideIcon, Minus, Moon, MousePointer2, PaintBucket, Pencil, Pipette, Square, Sun } from "lucide-react";
import { Tool } from "../../types";
import { Language, copy } from "../../i18n";

const tools = [
  { label: "Pencil (B)", icon: Pencil, value: "pencil" },
  { label: "Eraser (E)", icon: Eraser, value: "eraser" },
  { label: "Bucket (G)", icon: PaintBucket, value: "bucket" },
  { label: "Eyedropper (I)", icon: Pipette, value: "eyedropper" },
  { label: "Line (L)", icon: Minus, value: "line" },
  { label: "Rectangle (R)", icon: Square, value: "rectangle" },
  { label: "Ellipse (O)", icon: Circle, value: "ellipse" },
  { label: "Lighten (U)", icon: Sun, value: "lighten" },
  { label: "Darken (J)", icon: Moon, value: "darken" },
  { label: "Selection (M)", icon: MousePointer2, value: "selection" },
] satisfies Array<{ label: string; icon: LucideIcon; value: Tool }>;

type ToolbarProps = {
  activeTool: Tool;
  language: Language;
  onCollapse?: () => void;
  onSelectTool: (tool: Tool) => void;
};

export function Toolbar({ activeTool, language, onCollapse, onSelectTool }: ToolbarProps) {
  const [hoveredTool, setHoveredTool] = useState<Tool | null>(null);
  const [hoveredToolTop, setHoveredToolTop] = useState<number | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  const selectionHelp =
    language === "ko"
      ? {
          title: "선택",
          create: "드래그: 선택 영역을 만들거나 선택 박스를 이동합니다.",
          move: "안쪽에서 Shift + 드래그: 픽셀을 함께 이동합니다.",
          clipboard: "Ctrl+C / Ctrl+V / Ctrl+X: 복사, 붙여넣기, 잘라내기.",
          clear: "Esc 또는 바깥 클릭: 선택 해제.",
        }
      : {
          title: "Selection",
          create: "Drag: create or move the selection box.",
          move: "Shift + drag inside: move pixels with the box.",
          clipboard: "Ctrl+C / Ctrl+V / Ctrl+X: copy, stamp, cut.",
          clear: "Esc or outside click: clear selection.",
        };

  return (
    <aside ref={asideRef} className="relative hidden min-h-0 flex-col items-center overflow-visible border-l border-zinc-950 bg-zinc-800 p-2 shadow-[inset_1px_0_0_#3f3f46] md:flex">
      <div className="mb-2 flex h-6 w-full shrink-0 items-center justify-between border border-zinc-950 bg-zinc-700 px-1 font-pixel text-[10px] text-zinc-200">
        <span>{copy[language].tools}</span>
        {onCollapse && (
          <button
            className="grid h-5 w-5 place-items-center border border-zinc-950 bg-zinc-800 text-zinc-300 hover:bg-zinc-600 hover:text-amber-300"
            onClick={onCollapse}
            title={copy[language].expandTools}
            type="button"
          >
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-2 overflow-y-auto overscroll-contain pr-1 scrollbar-none">
        {tools.map(({ label, icon: Icon, value }) => (
          <button
            className={[
              "grid h-11 w-11 shrink-0 place-items-center border border-zinc-950 shadow-pixel",
              activeTool === value
                ? "bg-amber-300 text-zinc-950"
                : "bg-zinc-700 text-zinc-200 hover:bg-zinc-600",
            ].join(" ")}
            key={label}
            onMouseEnter={(event) => {
              setHoveredTool(value);
              if (value === "selection") {
                const asideTop = asideRef.current?.getBoundingClientRect().top ?? 0;
                const buttonRect = event.currentTarget.getBoundingClientRect();
                setHoveredToolTop(buttonRect.top - asideTop + buttonRect.height / 2);
              }
            }}
            onMouseLeave={() => {
              setHoveredTool(null);
              setHoveredToolTop(null);
            }}
            onClick={() => onSelectTool(value)}
            title={label}
            type="button"
          >
            <Icon size={20} strokeWidth={2.25} />
          </button>
        ))}
      </div>
      {hoveredTool === "selection" ? (
        <div
          className="pointer-events-none absolute right-full z-50 mr-2 w-64 -translate-y-1/2 border border-zinc-950 bg-zinc-900 p-2 text-left font-ui text-[11px] leading-relaxed text-zinc-300 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
          style={{ top: hoveredToolTop ?? 40 }}
        >
          <div className="mb-1 font-bold uppercase text-amber-300">{selectionHelp.title}</div>
          <div>{selectionHelp.create}</div>
          <div>{selectionHelp.move}</div>
          <div>{selectionHelp.clipboard}</div>
          <div>{selectionHelp.clear}</div>
        </div>
      ) : null}
    </aside>
  );
}
