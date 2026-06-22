import { Eraser, PaintBucket, Pencil, Pipette } from "lucide-react";
import { Tool } from "../../types";

const tools = [
  { label: "Pencil (B)", icon: Pencil, value: "pencil" },
  { label: "Eraser (E)", icon: Eraser, value: "eraser" },
  { label: "Bucket (G)", icon: PaintBucket, value: "bucket" },
  { label: "Eyedropper (I)", icon: Pipette, value: "eyedropper" },
] satisfies Array<{ label: string; icon: typeof Pencil; value: Tool }>;

type ToolbarProps = {
  activeTool: Tool;
  onSelectTool: (tool: Tool) => void;
};

export function Toolbar({ activeTool, onSelectTool }: ToolbarProps) {
  return (
    <aside className="flex flex-col items-center gap-2 border-l border-zinc-950 bg-zinc-800 p-2 shadow-[inset_1px_0_0_#3f3f46]">
      <div className="mb-1 h-6 w-full border border-zinc-950 bg-zinc-700 py-1 text-center font-pixel text-[10px] text-zinc-200">
        Tools
      </div>

      {tools.map(({ label, icon: Icon, value }) => (
        <button
          className={[
            "grid h-11 w-11 place-items-center border border-zinc-950 shadow-pixel",
            activeTool === value
              ? "bg-amber-300 text-zinc-950"
              : "bg-zinc-700 text-zinc-200 hover:bg-zinc-600",
          ].join(" ")}
          key={label}
          onClick={() => onSelectTool(value)}
          title={label}
          type="button"
        >
          <Icon size={20} strokeWidth={2.25} />
        </button>
      ))}
    </aside>
  );
}
