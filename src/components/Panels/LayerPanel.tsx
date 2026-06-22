import { useState, KeyboardEvent } from "react";
import { usePixelCanvas } from "../../hooks/usePixelCanvas";
import { Eye, EyeOff, Plus, Trash2, ArrowUp, ArrowDown, Merge } from "lucide-react";

type LayerPanelProps = {
  canvas: ReturnType<typeof usePixelCanvas>;
  showOtherLayers: boolean;
  onToggleOtherLayers: () => void;
};

export function LayerPanel({ canvas, showOtherLayers, onToggleOtherLayers }: LayerPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleStartRename = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
  };

  const handleFinishRename = (id: string) => {
    if (editName.trim()) {
      canvas.renameLayer(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, id: string) => {
    if (event.key === "Enter") {
      handleFinishRename(id);
    }
    if (event.key === "Escape") {
      setEditingId(null);
    }
  };

  // Aseprite 레이어 렌더링 순서: 배열의 역순이 시각적 위 (배열 뒤쪽이 레이어 위)
  const reversedLayers = [...canvas.layers].reverse();
  const activeLayerIndex = canvas.layers.findIndex((l) => l.id === canvas.activeLayerId);

  return (
    <section className="flex h-[210px] w-[176px] flex-col border border-zinc-950 bg-zinc-900/90 text-zinc-200 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-[2px]">
      {/* Title Bar */}
      <div className="flex h-6 shrink-0 items-center justify-between border-b border-zinc-950 bg-zinc-800 px-2 font-pixel text-[10px] font-bold text-zinc-300 uppercase select-none">
        <span className="text-amber-300 tracking-wider">Layers</span>
        <button
          className="grid h-4 w-4 place-items-center rounded hover:bg-zinc-700/60 text-zinc-400 hover:text-zinc-100 focus:outline-none"
          onClick={onToggleOtherLayers}
          title={showOtherLayers ? "Show Active Layer Only" : "Show All Layers"}
          type="button"
        >
          {showOtherLayers ? (
            <Eye size={11} className="text-amber-300" />
          ) : (
            <EyeOff size={11} className="text-zinc-500" />
          )}
        </button>
      </div>

      {/* Toolbar Buttons */}
      <div className="grid grid-cols-5 gap-1 border-b border-zinc-950 bg-zinc-800/80 p-1 shrink-0">
        <button
          className="grid h-6 w-full place-items-center border border-zinc-950 bg-zinc-700 text-zinc-200 hover:bg-zinc-600 active:bg-zinc-950"
          onClick={canvas.addLayer}
          title="Add New Layer"
          type="button"
        >
          <Plus size={10} strokeWidth={3} />
        </button>
        <button
          className="grid h-6 w-full place-items-center border border-zinc-950 bg-zinc-700 text-zinc-200 hover:bg-zinc-600 active:bg-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={canvas.layers.length <= 1}
          onClick={() => canvas.deleteLayer(canvas.activeLayerId)}
          title="Delete Selected Layer"
          type="button"
        >
          <Trash2 size={10} />
        </button>
        <button
          className="grid h-6 w-full place-items-center border border-zinc-950 bg-zinc-700 text-zinc-200 hover:bg-zinc-600 active:bg-zinc-950"
          onClick={() => canvas.reorderLayer(canvas.activeLayerId, "up")}
          title="Move Layer Up"
          type="button"
        >
          <ArrowUp size={10} />
        </button>
        <button
          className="grid h-6 w-full place-items-center border border-zinc-950 bg-zinc-700 text-zinc-200 hover:bg-zinc-600 active:bg-zinc-950"
          onClick={() => canvas.reorderLayer(canvas.activeLayerId, "down")}
          title="Move Layer Down"
          type="button"
        >
          <ArrowDown size={10} />
        </button>
        <button
          className="grid h-6 w-full place-items-center border border-zinc-950 bg-zinc-700 text-zinc-200 hover:bg-zinc-600 active:bg-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
          disabled={canvas.layers.length <= 1 || activeLayerIndex === 0}
          onClick={() => canvas.mergeLayerDown(canvas.activeLayerId)}
          title="Merge Layer Down"
          type="button"
        >
          <Merge size={10} />
        </button>
      </div>

      {/* Layer List */}
      <div className="flex-1 overflow-y-auto p-1 text-[10px] font-ui">
        <div className="flex flex-col gap-0.5">
          {reversedLayers.map((layer, index) => {
            const isSelected = layer.id === canvas.activeLayerId;
            const originalIndex = canvas.layers.length - 1 - index;

            return (
              <div
                draggable={true}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", originalIndex.toString());
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromIndexStr = e.dataTransfer.getData("text/plain");
                  if (fromIndexStr !== "") {
                    const fromIndex = parseInt(fromIndexStr, 10);
                    if (fromIndex !== originalIndex) {
                      canvas.reorderLayerTo(fromIndex, originalIndex);
                    }
                  }
                }}
                className={`grid grid-cols-[20px_1fr_16px] items-center h-6 border px-1 select-none gap-1 cursor-move transition-all ${
                  isSelected
                    ? "border-amber-300 bg-amber-300/10 text-amber-300 font-bold"
                    : "border-transparent bg-zinc-950/20 text-zinc-400 hover:bg-zinc-950/40 hover:text-white"
                }`}
                key={layer.id}
                onClick={() => canvas.setActiveLayerId(layer.id)}
              >
                {/* Visibility Eye */}
                <button
                  className="grid h-4 w-4 place-items-center rounded hover:bg-zinc-700/60 text-zinc-400 hover:text-zinc-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    canvas.toggleLayerVisibility(layer.id);
                  }}
                  type="button"
                >
                  {layer.visible ? (
                    <Eye size={10} className={isSelected ? "text-amber-300" : "text-zinc-300"} />
                  ) : (
                    <EyeOff size={10} className="text-zinc-600" />
                  )}
                </button>

                {/* Layer Name Display / Input */}
                <div className="truncate pr-1" onDoubleClick={() => handleStartRename(layer.id, layer.name)}>
                  {editingId === layer.id ? (
                    <input
                      autoFocus
                      className="h-4 w-full border border-zinc-950 bg-zinc-950 px-1 text-[9px] text-zinc-100 outline-none focus:border-amber-300"
                      onBlur={() => handleFinishRename(layer.id)}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, layer.id)}
                      onClick={(e) => e.stopPropagation()}
                      type="text"
                      value={editName}
                    />
                  ) : (
                    <span>{layer.name}</span>
                  )}
                </div>

                {/* Stack index */}
                <span className="text-right text-[8px] font-mono text-zinc-600">
                  {originalIndex + 1}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
