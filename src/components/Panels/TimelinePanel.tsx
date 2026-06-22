import { useState, useRef, useEffect } from "react";
import {
  Play,
  Pause,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Merge,
  Layers,
  Link,
  Unlink,
  Bookmark,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { usePixelCanvas } from "../../hooks/usePixelCanvas";

type TimelinePanelProps = {
  canvas: ReturnType<typeof usePixelCanvas>;
  onionSkinEnabled: boolean;
  onTogglePreviousFrame: () => void;
};

const PRESET_TAG_COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Pink", value: "#ec4899" },
  { name: "Teal", value: "#14b8a6" },
];

export function TimelinePanel({ canvas, onionSkinEnabled, onTogglePreviousFrame }: TimelinePanelProps) {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Custom Cel Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    frameId: string;
    layerId: string;
  } | null>(null);

  // Tag Modal states
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagName, setTagName] = useState("");
  const [tagFrom, setTagFrom] = useState(1);
  const [tagTo, setTagTo] = useState(1);
  const [tagColor, setTagColor] = useState("#ef4444");
  const [isCollapsed, setIsCollapsed] = useState(false);

  const activeFrameIndex = canvas.frames.findIndex((f) => f.id === canvas.activeFrameId);
  const activeLayerIndex = canvas.layers.findIndex((l) => l.id === canvas.activeLayerId);

  const handlePlayToggle = () => {
    canvas.setIsPlaying((prev) => !prev);
  };

  const startEditing = (id: string, currentName: string) => {
    setEditingLayerId(id);
    setEditingName(currentName);
  };

  const saveRename = () => {
    if (editingLayerId && editingName.trim()) {
      canvas.renameLayer(editingLayerId, editingName.trim());
    }
    setEditingLayerId(null);
  };

  // Close context menu on external click
  useEffect(() => {
    const handleClose = () => setContextMenu(null);
    if (contextMenu?.visible) {
      window.addEventListener("click", handleClose);
    }
    return () => window.removeEventListener("click", handleClose);
  }, [contextMenu]);

  useEffect(() => {
    if (editingLayerId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingLayerId]);

  const handleEditTag = (tag: any) => {
    setEditingTagId(tag.id);
    setTagName(tag.name);
    setTagFrom(tag.from + 1);
    setTagTo(tag.to + 1);
    setTagColor(tag.color);
    setIsTagModalOpen(true);
  };

  const handleTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagName.trim()) return;

    // Convert 1-based UI values to 0-based frame indices
    const fromIndex = Math.max(0, Math.min(canvas.frames.length - 1, tagFrom - 1));
    const toIndex = Math.max(fromIndex, Math.min(canvas.frames.length - 1, tagTo - 1));

    if (editingTagId) {
      canvas.updateFrameTag(editingTagId, tagName.trim(), fromIndex, toIndex, tagColor);
    } else {
      canvas.addFrameTag(tagName.trim(), fromIndex, toIndex, tagColor);
    }

    setIsTagModalOpen(false);
    setEditingTagId(null);
    setTagName("");
  };

  // Aseprite-like: Render top layers on top.
  const reversedLayers = [...canvas.layers].reverse();

  return (
    <section className={`flex shrink-0 flex-col border-t border-zinc-950 bg-zinc-800 text-zinc-200 transition-all duration-200 ${
      isCollapsed ? "h-8" : "h-[200px]"
    }`}>
      {/* 1. Timeline Toolbar Controls */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-zinc-950 bg-zinc-700 px-3 font-ui text-[12px] font-bold text-zinc-100 shadow-[inset_0_-1px_0_#3f3f46]">
        <div className="flex items-center gap-4">
          <span className="font-pixel text-[11px] tracking-wider text-amber-300 uppercase flex items-center gap-1.5 cursor-pointer" onClick={() => setIsCollapsed(!isCollapsed)}>
            <Layers size={11} className="text-amber-300" />
            Timeline Matrix {isCollapsed ? "▲" : "▼"}
          </span>

          {/* Matrix Management Selector */}
          <div className="flex items-center gap-1.5 border-l border-zinc-500 pl-4">
            <span className="text-[10px] text-zinc-400 font-normal">Matrix:</span>
            <select
              value={canvas.activeMatrixId}
              onChange={(e) => canvas.setActiveMatrixId(e.target.value)}
              className="h-6 border border-zinc-950 bg-zinc-800 px-2 text-[11px] text-zinc-100 outline-none focus:border-amber-300 rounded font-ui font-semibold"
            >
              {canvas.matrices.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={canvas.addMatrix}
              title="Add Animation Matrix"
              className="grid h-6 w-6 place-items-center border border-zinc-950 bg-zinc-800 text-zinc-200 hover:bg-zinc-600 active:bg-zinc-950 font-bold text-[13px] rounded"
            >
              +
            </button>
            <button
              type="button"
              disabled={canvas.matrices.length <= 1}
              onClick={() => {
                const currentMatrix = canvas.matrices.find((m: any) => m.id === canvas.activeMatrixId);
                const name = prompt("Enter new name for animation matrix:", currentMatrix?.name);
                if (name && name.trim()) canvas.renameMatrix(canvas.activeMatrixId, name.trim());
              }}
              title="Rename Selected Matrix"
              className="grid h-6 w-6 place-items-center border border-zinc-950 bg-zinc-800 text-zinc-200 hover:bg-zinc-600 active:bg-zinc-950 text-[10px] disabled:opacity-40 disabled:cursor-not-allowed font-semibold rounded"
            >
              R
            </button>
            <button
              type="button"
              disabled={canvas.matrices.length <= 1}
              onClick={() => {
                if (confirm(`Are you sure you want to delete this matrix?`)) {
                  canvas.deleteMatrix(canvas.activeMatrixId);
                }
              }}
              title="Delete Selected Matrix"
              className="grid h-6 w-6 place-items-center border border-zinc-950 bg-zinc-800 text-red-400 hover:bg-zinc-600 active:bg-zinc-950 text-[14px] font-bold disabled:opacity-40 disabled:cursor-not-allowed rounded"
            >
              -
            </button>
          </div>

          {/* Animation Playback Controls */}
          <div className="flex items-center gap-1 border-l border-zinc-500 pl-4">
            <button
              className={`grid h-6 w-6 place-items-center border border-zinc-950 bg-zinc-800 text-zinc-200 hover:bg-zinc-600 active:bg-zinc-950 ${
                canvas.isPlaying ? "border-amber-300 text-amber-300" : ""
              }`}
              onClick={handlePlayToggle}
              title={canvas.isPlaying ? "Pause Animation" : "Play Animation"}
              type="button"
            >
              {canvas.isPlaying ? <Pause size={12} strokeWidth={2.5} /> : <Play size={12} strokeWidth={2.5} />}
            </button>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[10px] text-zinc-400 font-normal">FPS:</span>
              <input
                className="h-5 w-10 border border-zinc-950 bg-zinc-950 px-1 text-center font-mono text-[11px] text-zinc-100 outline-none focus:border-amber-300"
                max={30}
                min={1}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(30, Number(e.target.value) || 1));
                  canvas.setFps(val);
                }}
                type="number"
                value={canvas.fps}
              />
            </div>
          </div>

          {/* Frame CRUD Actions */}
          <div className="flex items-center gap-1 border-l border-zinc-500 pl-4">
            <button
              className="flex h-6 items-center gap-1 border border-zinc-950 bg-zinc-800 px-2 text-[10px] text-zinc-200 hover:bg-zinc-600 active:bg-zinc-950"
              onClick={() => canvas.addFrame()}
              title="Add Blank Frame"
              type="button"
            >
              <Plus size={10} strokeWidth={3} />
              <span>Frame</span>
            </button>
            <button
              className="flex h-6 items-center gap-1 border border-zinc-950 bg-zinc-800 px-2 text-[10px] text-zinc-200 hover:bg-zinc-600 active:bg-zinc-950"
              onClick={() => {
                setEditingTagId(null);
                setTagName("");
                setTagFrom(activeFrameIndex + 1);
                setTagTo(activeFrameIndex + 1);
                setTagColor("#ef4444");
                setIsTagModalOpen(true);
              }}
              title="Tag a range of frames"
              type="button"
            >
              <Bookmark size={10} className="text-cyan-400" />
              <span>Tag</span>
            </button>
            <button
              className="flex h-6 items-center gap-1 border border-zinc-950 bg-zinc-800 px-2 text-[10px] text-zinc-200 hover:bg-zinc-600 active:bg-zinc-950"
              onClick={() => canvas.copyFrame(canvas.activeFrameId)}
              title="Copy Current Frame"
              type="button"
            >
              <Copy size={10} />
              <span>Copy</span>
            </button>
            <button
              className="flex h-6 items-center gap-1 border border-zinc-950 bg-zinc-800 px-2 text-[10px] text-zinc-200 hover:bg-zinc-600 active:bg-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => canvas.pasteFrame()}
              disabled={!canvas.hasCopiedFrame}
              title="Paste Copied Frame After Current"
              type="button"
            >
              <Copy size={10} className="scale-x-[-1]" />
              <span>Paste</span>
            </button>
            <button
              className="grid h-6 w-6 place-items-center border border-zinc-950 bg-zinc-800 text-zinc-200 hover:bg-zinc-600 active:bg-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={canvas.frames.length <= 1}
              onClick={() => canvas.deleteFrame(canvas.activeFrameId)}
              title="Delete Selected Frame"
              type="button"
            >
              <Trash2 size={11} />
            </button>
          </div>

          {/* Frame Sequence Reordering */}
          <div className="flex items-center gap-1 border-l border-zinc-500 pl-4">
            <button
              className="grid h-6 w-6 place-items-center border border-zinc-950 bg-zinc-800 text-zinc-200 hover:bg-zinc-600 active:bg-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={activeFrameIndex <= 0}
              onClick={() => canvas.reorderFrame(canvas.activeFrameId, "left")}
              title="Move Frame Left"
              type="button"
            >
              <ArrowLeft size={11} />
            </button>
            <button
              className="grid h-6 w-6 place-items-center border border-zinc-950 bg-zinc-800 text-zinc-200 hover:bg-zinc-600 active:bg-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={activeFrameIndex === -1 || activeFrameIndex >= canvas.frames.length - 1}
              onClick={() => canvas.reorderFrame(canvas.activeFrameId, "right")}
              title="Move Frame Right"
              type="button"
            >
              <ArrowRight size={11} />
            </button>
          </div>
        </div>

        {/* Previous Frame & Collapse Control */}
        <div className="flex items-center gap-2">
          <button
            className={`flex h-6 items-center gap-1.5 border border-zinc-950 px-2 text-[10px] font-semibold shadow-pixel transition-all hover:bg-zinc-600 active:bg-zinc-950 ${
              onionSkinEnabled
                ? "bg-amber-300/10 border-amber-300 text-amber-300"
                : "bg-zinc-800 border-zinc-950 text-zinc-400"
            }`}
            onClick={onTogglePreviousFrame}
            title="Toggle Previous Frame Overlay"
            type="button"
          >
            <Eye size={11} />
            <span>Previous Frame</span>
          </button>
          
          <button
            className="flex h-6 w-6 items-center justify-center border border-zinc-950 bg-zinc-800 hover:bg-zinc-600 active:bg-zinc-950 text-zinc-300 transition-transform"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand Timeline" : "Collapse Timeline"}
            type="button"
          >
            {isCollapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* 2. Main 2D Matrix Table Grid */}
      {!isCollapsed && (
        <div className="flex flex-1 min-h-0 overflow-y-auto overflow-x-hidden select-none">
        
        {/* A. Left Sidebar: Layer Names Column */}
        <div className="w-[180px] shrink-0 border-r border-zinc-950 bg-zinc-900/90 flex flex-col min-h-0">
          {/* Header Corner Slot - Extra height to cover Tag row + Frame numbers row */}
          <div className="h-[48px] shrink-0 border-b border-zinc-950 bg-zinc-950/80 px-2 flex flex-col justify-center gap-1 font-ui text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
            <div className="flex items-center justify-between">
              <span>Layers</span>
              <div className="flex gap-1.5">
                <button
                  onClick={canvas.addLayer}
                  className="hover:text-white"
                  title="Add New Layer"
                >
                  <Plus size={10} strokeWidth={2.5} />
                </button>
                <button
                  disabled={canvas.layers.length <= 1 || activeLayerIndex <= 0}
                  onClick={() => canvas.mergeLayerDown(canvas.activeLayerId)}
                  className="hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400"
                  title="Merge Down"
                >
                  <Merge size={10} />
                </button>
              </div>
            </div>
          </div>

          {/* Layer Row List – 드래그앤드롭으로 순서 변경 지원 */}
          <div className="flex-1 overflow-y-auto scrollbar-none">
            {reversedLayers.map((layer) => {
              const isSelected = layer.id === canvas.activeLayerId;
              const idxInHook = canvas.layers.findIndex((l) => l.id === layer.id);

              return (
                <div
                  key={layer.id}
                  draggable={true}
                  onDragStart={(e) => {
                    // 드래그 시작: hook 기준 실제 인덱스를 전달
                    e.dataTransfer.setData("layer-index", idxInHook.toString());
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromIdxStr = e.dataTransfer.getData("layer-index");
                    if (fromIdxStr === "") return;
                    const fromIdx = parseInt(fromIdxStr, 10);
                    if (fromIdx !== idxInHook) {
                      canvas.reorderLayerTo(fromIdx, idxInHook);
                    }
                  }}
                  onClick={() => canvas.setActiveLayerId(layer.id)}
                  className={`group h-7 flex items-center justify-between px-2 font-ui text-[11px] border-b border-zinc-950/40 cursor-move transition-colors ${
                    isSelected
                      ? "bg-amber-300/10 text-amber-300 font-bold border-l-2 border-l-amber-300"
                      : "hover:bg-zinc-800 text-zinc-300 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {/* Visibility eye toggle */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        canvas.toggleLayerVisibility(layer.id);
                      }}
                      className="text-zinc-400 hover:text-white"
                      title={layer.visible ? "Hide Layer" : "Show Layer"}
                    >
                      {layer.visible ? <Eye size={12} /> : <EyeOff size={12} className="text-red-400" />}
                    </button>

                    {/* Editable name */}
                    {editingLayerId === layer.id ? (
                      <input
                        ref={inputRef}
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onBlur={saveRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveRename();
                          if (e.key === "Escape") setEditingLayerId(null);
                        }}
                        className="bg-zinc-950 text-white font-ui text-[11px] border border-amber-300 px-1 py-0.5 outline-none rounded w-full"
                      />
                    ) : (
                      <span
                        onDoubleClick={() => startEditing(layer.id, layer.name)}
                        className="truncate block select-none"
                        title="Double-click to rename"
                      >
                        {layer.name}
                      </span>
                    )}
                  </div>

                  {/* 삭제 버튼 – hover 시 표시 */}
                  <div className="opacity-0 group-hover:opacity-100 flex gap-0.5 ml-1 transition-opacity shrink-0">
                    <button
                      disabled={canvas.layers.length <= 1}
                      onClick={(e) => {
                        e.stopPropagation();
                        canvas.deleteLayer(layer.id);
                      }}
                      className="text-zinc-400 hover:text-red-400 disabled:opacity-25"
                      title="Delete Layer"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* B. Right Side: Scrollable Frames Headers & Cels Grid */}
        <div className="flex-1 overflow-auto flex flex-col min-h-0 scrollbar-thin">
          
          {/* Tag Blocks Row */}
          <div className="h-6 shrink-0 border-b border-zinc-950 bg-zinc-950/60 relative flex items-center min-w-max select-none" style={{ height: "24px" }}>
            {canvas.tags.map((tag) => {
              const leftOffset = tag.from * 36;
              const width = (tag.to - tag.from + 1) * 36;
              return (
                <div
                  key={tag.id}
                  className="absolute top-0.5 bottom-0.5 flex items-center justify-between px-1.5 font-ui text-[9px] font-bold text-white rounded cursor-pointer shadow-[inset_0_-2px_0_rgba(255,255,255,0.2)] hover:brightness-110 active:brightness-90 transition-all"
                  style={{
                    left: `${leftOffset}px`,
                    width: `${width}px`,
                    backgroundColor: tag.color,
                  }}
                  title={`${tag.name} (Frames ${tag.from + 1}-${tag.to + 1}) - Double click to edit`}
                  onDoubleClick={() => handleEditTag(tag)}
                >
                  <span className="truncate flex-1 pr-1">{tag.name}</span>
                  <button
                    className="hover:scale-125 text-white/80 hover:text-white font-ui font-normal text-[10px]"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete tag "${tag.name}"?`)) {
                        canvas.deleteFrameTag(tag.id);
                      }
                    }}
                    title="Delete Tag"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>

          {/* Header Row: Frame Selectors */}
          <div className="h-6 shrink-0 border-b border-zinc-950 bg-zinc-950/80 flex items-center min-w-max">
            {canvas.frames.map((frame, index) => {
              const isSelected = frame.id === canvas.activeFrameId;
              return (
                <button
                  key={frame.id}
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", index.toString());
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
                      if (fromIndex !== index) {
                        canvas.reorderFrameTo(fromIndex, index);
                      }
                    }
                  }}
                  onClick={() => {
                    canvas.setActiveFrameId(frame.id);
                    canvas.setIsPlaying(false);
                  }}
                  className={`w-9 h-full flex items-center justify-center font-pixel text-[10px] border-r border-zinc-950 shrink-0 select-none transition-colors cursor-move ${
                    isSelected
                      ? "bg-amber-300/10 border-b-2 border-b-amber-300 text-amber-300 font-bold"
                      : "hover:bg-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                  title={`Frame ${index + 1} (Drag to reorder)`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          {/* Matrix body: Cels */}
          <div className="flex-1 flex flex-col overflow-y-auto scrollbar-none min-w-max">
            {reversedLayers.map((layer) => {
              const isLayerSelected = layer.id === canvas.activeLayerId;
              
              return (
                <div key={layer.id} className="h-7 flex items-center border-b border-zinc-950/30 shrink-0">
                  {canvas.frames.map((frame) => {
                    const isFrameSelected = frame.id === canvas.activeFrameId;
                    const isCelSelected = isLayerSelected && isFrameSelected;

                    const cel = frame.cels.find((c) => c.layerId === layer.id);
                    const frameIndex = canvas.frames.findIndex((f) => f.id === frame.id);
                    const isLinkedToPrev = frameIndex > 0 && !!frame.cels.find((c) => c.layerId === layer.id)?.linkedToFrameId;
                    const isLinkedToNext = frameIndex < canvas.frames.length - 1 && 
                      !!canvas.frames[frameIndex + 1].cels.find((c) => c.layerId === layer.id)?.linkedToFrameId;
                    const isLinked = isLinkedToPrev || isLinkedToNext;

                    // Resolve relationship within the linked group
                    const isCapsuleStart = !isLinkedToPrev && isLinkedToNext;
                    const isCapsuleEnd = isLinkedToPrev && !isLinkedToNext;
                    const isCapsuleMiddle = isLinkedToPrev && isLinkedToNext;
                    const isCapsulePart = isCapsuleStart || isCapsuleEnd || isCapsuleMiddle;
                    
                    // Resolve pixels using getResolvedCel
                    const resolved = canvas.getResolvedCel(frame.id, layer.id);
                    const hasPixels = resolved ? resolved.cel.pixels.some((pixel) => pixel !== null) : false;

                    return (
                      <button
                        key={frame.id}
                        type="button"
                        onClick={() => {
                          canvas.setActiveFrameId(frame.id);
                          canvas.setActiveLayerId(layer.id);
                          canvas.setIsPlaying(false);
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            visible: true,
                            x: e.clientX,
                            y: e.clientY,
                            frameId: frame.id,
                            layerId: layer.id,
                          });
                        }}
                        className={`w-9 h-full flex items-center justify-center border-r border-zinc-950/10 shrink-0 transition-all focus:outline-none relative ${
                          isCelSelected
                            ? "bg-amber-300/15"
                            : isFrameSelected
                            ? "bg-zinc-900/30"
                            : isLayerSelected
                            ? "bg-zinc-800/30"
                            : "hover:bg-zinc-800/50"
                        }`}
                        title={`Frame ${canvas.frames.findIndex(f => f.id === frame.id) + 1}, Layer ${layer.name}${isLinked ? " (Linked)" : ""}`}
                      >
                        {/* Aseprite-style Linked Cels Visual (Horizontal continuous capsule for all connected cells) */}
                        {isCapsulePart ? (
                          <div className="w-full h-full relative flex items-center justify-center">
                            {/* Horizontal Capsule connection segments */}
                            {isCapsuleStart && (
                              <div className={`absolute left-[16px] right-0 h-3.5 z-0 ${hasPixels ? "bg-zinc-100" : "bg-zinc-900/30 border-t border-b border-zinc-700/50"} rounded-l-full ${isCelSelected ? "ring-1 ring-amber-300" : ""}`} />
                            )}
                            {isCapsuleMiddle && (
                              <div className={`absolute left-0 right-0 h-3.5 z-0 ${hasPixels ? "bg-zinc-100" : "bg-zinc-900/30 border-t border-b border-zinc-700/50"} ${isCelSelected ? "ring-1 ring-amber-300" : ""}`} />
                            )}
                            {isCapsuleEnd && (
                              <div className={`absolute left-0 right-[16px] h-3.5 z-0 ${hasPixels ? "bg-zinc-100" : "bg-zinc-900/30 border-t border-b border-zinc-700/50"} rounded-r-full ${isCelSelected ? "ring-1 ring-amber-300" : ""}`} />
                            )}

                            {/* Parent Dot in the center of the START cell */}
                            {isCapsuleStart && (
                              <div
                                className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all z-10 ${
                                  isCelSelected
                                    ? "border-2 border-amber-300"
                                    : "border border-zinc-500/80"
                                } ${
                                  hasPixels
                                    ? isCelSelected
                                      ? "bg-amber-300"
                                      : "bg-zinc-100 shadow-sm border-zinc-400"
                                    : "bg-transparent"
                                }`}
                              >
                                {!hasPixels && isCelSelected && (
                                  <div className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                                )}
                              </div>
                            )}

                            {/* Thin vertical frame divider within the continuous pill */}
                            {isLinkedToPrev && (
                              <div className={`absolute left-0 top-[6px] bottom-[6px] w-[1px] ${hasPixels ? "bg-zinc-400/60" : "bg-zinc-700/50"} z-10`} />
                            )}
                          </div>
                        ) : (
                          /* Normal unlinked Cel (Standalone button) */
                          <div
                            className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all ${
                              isCelSelected
                                ? "border-2 border-amber-300"
                                : "border border-zinc-600/70"
                            } ${
                              hasPixels
                                ? isCelSelected
                                  ? "bg-amber-300"
                                  : "bg-zinc-300 shadow-sm"
                                : "bg-transparent"
                            }`}
                          >
                            {!hasPixels && isCelSelected && (
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                  
                  {/* Row end empty filler */}
                  <div className={`flex-1 h-full border-r border-zinc-950/10 ${isLayerSelected ? "bg-zinc-800/20" : ""}`} />
                </div>
              );
            })}
          </div>

        </div>

      </div>
      )}

      {/* 3. Custom Cel Context Menu */}
      {contextMenu?.visible && (
        <div
          className="fixed z-50 w-48 border border-zinc-950 bg-zinc-850 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.6)] text-zinc-100 font-ui text-[11px]"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={() => setContextMenu(null)}
        >
          {canvas.frames.findIndex((f) => f.id === contextMenu.frameId) > 0 && (
            <button
              className="w-full px-3 py-1.5 text-left hover:bg-zinc-700 hover:text-white flex items-center gap-1.5"
              onClick={() => {
                canvas.linkCelToPrevious(contextMenu.frameId, contextMenu.layerId);
              }}
            >
              <Link size={11} className="text-blue-400" />
              <span>Link to Previous Frame</span>
            </button>
          )}

          {(() => {
            const frame = canvas.frames.find((f) => f.id === contextMenu.frameId);
            const cel = frame?.cels.find((c) => c.layerId === contextMenu.layerId);
            const isLinked = !!cel?.linkedToFrameId;
            if (isLinked) {
              return (
                <button
                  className="w-full px-3 py-1.5 text-left hover:bg-zinc-700 hover:text-white flex items-center gap-1.5"
                  onClick={() => {
                    canvas.unlinkCel(contextMenu.frameId, contextMenu.layerId);
                  }}
                >
                  <Unlink size={11} className="text-red-400" />
                  <span>Unlink Cel (Make Copy)</span>
                </button>
              );
            }
            return null;
          })()}

          <button
            className="w-full px-3 py-1.5 text-left hover:bg-zinc-700 text-red-400 flex items-center gap-1.5"
            onClick={() => {
              canvas.clearCel(contextMenu.frameId, contextMenu.layerId);
            }}
          >
            <Trash2 size={11} />
            <span>Clear Cel</span>
          </button>
        </div>
      )}

      {/* 4. Frame Tag Dialog Modal */}
      {isTagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[1px]">
          <form
            onSubmit={handleTagSubmit}
            className="w-80 border border-zinc-950 bg-zinc-900 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.6)] text-zinc-100 font-ui text-[12px]"
          >
            <div className="mb-4 flex items-center justify-between border-b border-zinc-950 pb-2 font-pixel text-[13px] text-amber-300 uppercase">
              <span>{editingTagId ? "Edit Frame Tag" : "Create Frame Tag"}</span>
              <button
                type="button"
                className="h-5 w-5 border border-zinc-950 bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                onClick={() => {
                  setIsTagModalOpen(false);
                  setEditingTagId(null);
                  setTagName("");
                }}
              >
                x
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-zinc-400 font-semibold">Tag Name</span>
                <input
                  type="text"
                  required
                  placeholder="e.g. Idle, Walk, Jump"
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                  className="h-8 border border-zinc-950 bg-zinc-950 px-2 text-zinc-100 outline-none focus:border-amber-300"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-zinc-400 font-semibold">From Frame</span>
                  <input
                    type="number"
                    min={1}
                    max={canvas.frames.length}
                    required
                    value={tagFrom}
                    onChange={(e) => setTagFrom(Number(e.target.value))}
                    className="h-8 border border-zinc-950 bg-zinc-950 px-2 text-zinc-100 outline-none focus:border-amber-300"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-zinc-400 font-semibold">To Frame</span>
                  <input
                    type="number"
                    min={tagFrom}
                    max={canvas.frames.length}
                    required
                    value={tagTo}
                    onChange={(e) => setTagTo(Number(e.target.value))}
                    className="h-8 border border-zinc-950 bg-zinc-950 px-2 text-zinc-100 outline-none focus:border-amber-300"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-zinc-400 font-semibold">Tag Color</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {PRESET_TAG_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setTagColor(c.value)}
                      className={`h-6 rounded border transition-all ${
                        tagColor === c.value
                          ? "border-white scale-105 shadow-md"
                          : "border-transparent opacity-80 hover:opacity-100"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="h-9 border border-zinc-950 bg-zinc-700 font-bold hover:bg-zinc-600 shadow-pixel"
                  onClick={() => {
                    setIsTagModalOpen(false);
                    setEditingTagId(null);
                    setTagName("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-9 border border-zinc-950 bg-blue-600 font-bold text-white hover:bg-blue-500 shadow-pixel"
                >
                  {editingTagId ? "Save" : "Create"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
