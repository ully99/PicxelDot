import { useState, useRef, useEffect } from "react";
import { usePixelCanvas } from "../../hooks/usePixelCanvas";
import { GIFEncoder } from "gifenc";
import { parseGIF, decompressFrames } from "gifuct-js";
import { FolderOpen, Save, Settings, HelpCircle, FileImage, Eye, Layers, Menu } from "lucide-react";
import { Pixel, Frame, Layer, Cel, Matrix, ShortcutAction } from "../../types";
import { Language, LanguageToggle, copy } from "../../i18n";

type HeaderMenuProps = {
  canvas: ReturnType<typeof usePixelCanvas>;
  language: Language;
  onLanguageChange: (language: Language) => void;
  onNavigateHome: () => void;
  onionSkinEnabled: boolean;
  onTogglePreviousFrame: () => void;
};

type FrameThumbnailProps = {
  frame: Frame;
  layers: Layer[];
  width: number;
  height: number;
  canvas: ReturnType<typeof usePixelCanvas>;
};

function FrameThumbnail({ frame, layers, width, height, canvas }: FrameThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width * 2, height * 2);
    context.imageSmoothingEnabled = false;

    // Draw checkerboard background (micro grid)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        context.fillStyle = (x + y) % 2 === 0 ? "#27272a" : "#18181b";
        context.fillRect(x * 2, y * 2, 2, 2);
      }
    }

    // Merge and draw layers
    layers.forEach((layer) => {
      if (!layer.visible) return;
      const resolved = canvas.getResolvedCel(frame.id, layer.id);
      if (!resolved) return;

      resolved.cel.pixels.forEach((color, index) => {
        if (!color) return;
        context.fillStyle = color;
        const px = (index % width) * 2;
        const py = Math.floor(index / width) * 2;
        context.fillRect(px, py, 2, 2);
      });
    });
  }, [frame, layers, width, height, canvas]);

  return (
    <canvas
      ref={canvasRef}
      width={width * 2}
      height={height * 2}
      className="border border-zinc-950 bg-zinc-950 shadow-md rounded shrink-0"
    />
  );
}

const shortcutItems: Array<{ id: ShortcutAction; label: string }> = [
  { id: "pencil", label: "Pencil Tool" },
  { id: "eraser", label: "Eraser Tool" },
  { id: "bucket", label: "Bucket Fill Tool" },
  { id: "eyedropper", label: "Eyedropper Tool" },
  { id: "line", label: "Line Tool" },
  { id: "rectangle", label: "Rectangle Tool" },
  { id: "ellipse", label: "Ellipse Tool" },
  { id: "lighten", label: "Lighten Tool" },
  { id: "darken", label: "Darken Tool" },
  { id: "selection", label: "Selection Tool" },
  { id: "brushSizeDecrease", label: "Decrease Brush Size" },
  { id: "brushSizeIncrease", label: "Increase Brush Size" },
];

export function HeaderMenu({ canvas, language, onLanguageChange, onNavigateHome, onionSkinEnabled, onTogglePreviousFrame }: HeaderMenuProps) {
  const t = copy[language];
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  // Modals Open State
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [isExportPNGOpen, setIsExportPNGOpen] = useState(false);
  const [isExportGIFOpen, setIsExportGIFOpen] = useState(false);
  const [isExportSpritesheetOpen, setIsExportSpritesheetOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSettingOpen, setIsSettingOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [recordingAction, setRecordingAction] = useState<string | null>(null);

  useEffect(() => {
    if (!recordingAction) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const key = e.key;
      // Handle escape to cancel
      if (key === "Escape") {
        setRecordingAction(null);
        return;
      }

      // Ignore standard modifier keys
      if (["control", "shift", "alt", "meta"].includes(key.toLowerCase())) {
        return;
      }

      canvas.updateShortcut(recordingAction as ShortcutAction, key);
      setRecordingAction(null);
    };

    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [recordingAction, canvas]);

  // New Project Form States
  const [newWidth, setNewWidth] = useState(32);
  const [newHeight, setNewHeight] = useState(32);
  const [settingsWidth, setSettingsWidth] = useState(32);
  const [settingsHeight, setSettingsHeight] = useState(32);
  const [isAspectLocked, setIsAspectLocked] = useState(true);

  // Export scale option
  const [exportScale, setExportScale] = useState(16);

  // PNG Export Selected Frame
  const [selectedPNGFrameId, setSelectedPNGFrameId] = useState<string>("");

  // GIF Export Selected Matrix
  const [selectedGIFMatrixId, setSelectedGIFMatrixId] = useState<string>("");

  // Import related states
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<"image-choose" | "single-image" | "spritesheet" | "gif" | null>(null);
  const [importedImgSrc, setImportedImgSrc] = useState<string | null>(null);
  const [importFitOption, setImportFitOption] = useState<"original" | "fit">("original");

  // Spritesheet Import parameters
  const [sheetFrameWidth, setSheetFrameWidth] = useState(32);
  const [sheetFrameHeight, setSheetFrameHeight] = useState(32);
  const [sheetImportMethod, setSheetImportMethod] = useState<"single" | "multi">("single");

  // GIF Import target matrix
  const [gifTargetMatrixId, setGifTargetMatrixId] = useState<string>("new");

  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (canvas.frames.length > 0 && !selectedPNGFrameId) {
      setSelectedPNGFrameId(canvas.frames[0].id);
    }
  }, [canvas.frames, selectedPNGFrameId]);

  useEffect(() => {
    if (canvas.matrices.length > 0 && !selectedGIFMatrixId) {
      setSelectedGIFMatrixId(canvas.activeMatrixId);
    }
  }, [canvas.matrices, canvas.activeMatrixId, selectedGIFMatrixId]);

  useEffect(() => {
    if (isSettingOpen) {
      setSettingsWidth(canvas.width);
      setSettingsHeight(canvas.height);
    }
  }, [canvas.height, canvas.width, isSettingOpen]);

  // Close menus on clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleMenuClick = (menu: string) => {
    setActiveMenu(activeMenu === menu ? null : menu);
  };

  const handleNewCanvas = () => {
    canvas.resizeCanvas(newWidth, newHeight);
    setIsNewModalOpen(false);
    setActiveMenu(null);
  };

  const setSettingsCanvasSize = (nextWidth: number, nextHeight: number) => {
    const clampedWidth = Math.max(4, Math.min(256, Math.round(nextWidth) || 4));
    const clampedHeight = Math.max(4, Math.min(256, Math.round(nextHeight) || 4));
    setSettingsWidth(clampedWidth);
    setSettingsHeight(clampedHeight);
  };

  const handleSettingsWidthChange = (value: number) => {
    const nextWidth = Math.max(4, Math.min(256, Math.round(value) || 4));
    setSettingsWidth(nextWidth);
    if (isAspectLocked) {
      setSettingsHeight(nextWidth);
    }
  };

  const handleSettingsHeightChange = (value: number) => {
    const nextHeight = Math.max(4, Math.min(256, Math.round(value) || 4));
    setSettingsHeight(nextHeight);
    if (isAspectLocked) {
      setSettingsWidth(nextHeight);
    }
  };

  const applySettingsCanvasSize = () => {
    canvas.resizeCanvas(settingsWidth, settingsHeight);
  };

  const handleClearCanvas = () => {
    if (confirm("Are you sure you want to clear the canvas? All progress will be lost.")) {
      canvas.clearCanvas();
      setActiveMenu(null);
    }
  };

  // Project (.dotproj) Save/Load
  const handleSaveProject = () => {
    const data = {
      version: "1.0",
      width: canvas.width,
      height: canvas.height,
      layers: canvas.layers,
      matrices: canvas.matrices,
      activeMatrixId: canvas.activeMatrixId,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `project-${Date.now()}.dotproj`;
    link.href = url;
    link.click();
    setActiveMenu(null);
  };

  const handleLoadProjectClick = () => {
    projectInputRef.current?.click();
    setActiveMenu(null);
  };

  const handleProjectFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        canvas.loadProject(parsed);
      } catch (err) {
        alert("Invalid project file format. Please upload a valid .dotproj file.");
      }
    };
    reader.readAsText(file);
  };

  // 1. Export PNG
  const handleExportPNGSubmit = () => {
    const activeMatrix = canvas.matrices.find((m) => m.id === canvas.activeMatrixId) || canvas.matrices[0];
    const frame = activeMatrix.frames.find((f) => f.id === selectedPNGFrameId);
    if (!frame) return;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width * exportScale;
    tempCanvas.height = canvas.height * exportScale;
    const ctx = tempCanvas.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = false;

      canvas.layers.forEach((layer) => {
        if (!layer.visible) return;
        const resolved = canvas.getResolvedCel(frame.id, layer.id);
        if (!resolved) return;

        resolved.cel.pixels.forEach((color, index) => {
          if (!color) return;
          ctx.fillStyle = color;
          const px = (index % canvas.width) * exportScale;
          const py = Math.floor(index / canvas.width) * exportScale;
          ctx.fillRect(px, py, exportScale, exportScale);
        });
      });

      const url = tempCanvas.toDataURL("image/png");
      const link = document.createElement("a");
      const frameIdx = activeMatrix.frames.indexOf(frame) + 1;
      link.download = `frame-${frameIdx}-${canvas.width}x${canvas.height}.png`;
      link.href = url;
      link.click();
      setIsExportPNGOpen(false);
    }
  };

  // 2. Export GIF
  const handleExportGIFSubmit = () => {
    const matrix = canvas.matrices.find((m) => m.id === selectedGIFMatrixId);
    if (!matrix || matrix.frames.length === 0) return;

    const encoder = GIFEncoder();
    encoder.writeHeader();

    // Collect all unique colors for the palette
    const colors = new Set<string>();
    matrix.frames.forEach((frame) => {
      canvas.layers.forEach((layer) => {
        const cel = frame.cels.find((c) => c.layerId === layer.id);
        if (cel) {
          cel.pixels.forEach((c) => {
            if (c) colors.add(c.toLowerCase());
          });
        }
      });
    });

    const paletteList = Array.from(colors);
    if (paletteList.length > 255) {
      paletteList.length = 255;
    }

    // Flat RGBA format requires palette list
    const palette: [number, number, number][] = [[0, 0, 0]]; // Index 0: Transparent
    const colorToIndex = new Map<string, number>();

    paletteList.forEach((hex, idx) => {
      const clean = hex.replace("#", "");
      const num = parseInt(clean, 16);
      const r = (num >> 16) & 255;
      const g = (num >> 8) & 255;
      const b = num & 255;
      palette.push([r, g, b]);
      colorToIndex.set(hex.toLowerCase(), idx + 1);
    });

    matrix.frames.forEach((frame) => {
      const combined = Array.from<Pixel>({ length: canvas.width * canvas.height }).fill(null);
      canvas.layers.forEach((layer) => {
        if (!layer.visible) return;
        const resolved = canvas.getResolvedCel(frame.id, layer.id);
        if (resolved) {
          resolved.cel.pixels.forEach((color, index) => {
            if (color) {
              combined[index] = color;
            }
          });
        }
      });

      const frameWidth = canvas.width * exportScale;
      const frameHeight = canvas.height * exportScale;
      const indexed = new Uint8Array(frameWidth * frameHeight);

      // Perform nearest neighbor scaling
      for (let y = 0; y < frameHeight; y++) {
        const origY = Math.floor(y / exportScale);
        for (let x = 0; x < frameWidth; x++) {
          const origX = Math.floor(x / exportScale);
          const origIndex = origY * canvas.width + origX;
          const color = combined[origIndex];

          if (!color) {
            indexed[y * frameWidth + x] = 0;
          } else {
            indexed[y * frameWidth + x] = colorToIndex.get(color.toLowerCase()) ?? 0;
          }
        }
      }

      encoder.writeFrame(indexed, frameWidth, frameHeight, {
        palette,
        transparent: true,
        transparentIndex: 0,
        delay: 1000 / canvas.fps,
        repeat: 0,
      });
    });

    encoder.finish();
    const buffer = encoder.bytes();
    const blob = new Blob([buffer], { type: "image/gif" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `${matrix.name}-${canvas.width * exportScale}x${canvas.height * exportScale}.gif`;
    link.href = url;
    link.click();
    setIsExportGIFOpen(false);
  };

  // 3. Export Spritesheet (row per matrix)
  const handleExportSpritesheetSubmit = () => {
    const maxFrames = Math.max(...canvas.matrices.map((m) => m.frames.length), 1);
    const matrixCount = canvas.matrices.length;

    const sheetWidth = maxFrames * canvas.width * exportScale;
    const sheetHeight = matrixCount * canvas.height * exportScale;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = sheetWidth;
    tempCanvas.height = sheetHeight;
    const ctx = tempCanvas.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = false;

      canvas.matrices.forEach((matrix, rowIndex) => {
        matrix.frames.forEach((frame, colIndex) => {
          canvas.layers.forEach((layer) => {
            if (!layer.visible) return;
            const resolved = canvas.getResolvedCel(frame.id, layer.id);
            if (!resolved) return;

            resolved.cel.pixels.forEach((color, index) => {
              if (!color) return;
              ctx.fillStyle = color;
              const pixelX = colIndex * canvas.width + (index % canvas.width);
              const pixelY = rowIndex * canvas.height + Math.floor(index / canvas.width);
              ctx.fillRect(pixelX * exportScale, pixelY * exportScale, exportScale, exportScale);
            });
          });
        });
      });

      const url = tempCanvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `spritesheet-${canvas.width * exportScale}x${canvas.height * exportScale}.png`;
      link.href = url;
      link.click();
      setIsExportSpritesheetOpen(false);
    }
  };

  // File loading menu clicked
  const handleImportFileClick = () => {
    fileInputRef.current?.click();
    setActiveMenu(null);
  };

  // File change handler (PNG/GIF/JPG)
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith(".gif")) {
      setImportedFile(file);
      setImportType("gif");
      setGifTargetMatrixId("new");
      setIsImportModalOpen(true);
      return;
    }

    // PNG / JPG
    const reader = new FileReader();
    reader.onload = (e) => {
      setImportedFile(file);
      setImportedImgSrc(e.target?.result as string);
      setImportType("image-choose");
      setIsImportModalOpen(true);
    };
    reader.readAsDataURL(file);
  };

  // Confirm Single PNG import
  const handleImportPNGConfirm = () => {
    if (!importedImgSrc) return;

    const img = new Image();
    img.onload = () => {
      const targetWidth = importFitOption === "original" ? img.width : canvas.width;
      const targetHeight = importFitOption === "original" ? img.height : canvas.height;

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = targetWidth;
      tempCanvas.height = targetHeight;
      const ctx = tempCanvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const data = imgData.data;
      const pixelArray: (string | null)[] = [];

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        if (a < 10) {
          pixelArray.push(null);
        } else {
          const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
          pixelArray.push(hex);
        }
      }

      // Check option: resize canvas or add to active matrix
      if (importFitOption === "original") {
        canvas.importCanvas(pixelArray, targetWidth, targetHeight);
      } else {
        // Appends to target active matrix
        canvas.importFramesToMatrix(canvas.activeMatrixId, [pixelArray]);
      }

      setIsImportModalOpen(false);
      setImportedFile(null);
      setImportedImgSrc(null);
    };
    img.src = importedImgSrc;
  };

  // Confirm Spritesheet Import
  const handleImportSpritesheetConfirm = () => {
    if (!importedImgSrc) return;

    const img = new Image();
    img.onload = () => {
      const cols = Math.floor(img.width / sheetFrameWidth);
      const rows = Math.floor(img.height / sheetFrameHeight);

      if (cols <= 0 || rows <= 0) {
        alert("Invalid slice dimensions. Slices must be smaller than the spritesheet.");
        return;
      }

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = sheetFrameWidth;
      tempCanvas.height = sheetFrameHeight;
      const ctx = tempCanvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = false;

      // Slice frames
      if (sheetImportMethod === "single") {
        // Load sequentially into active matrix
        const framesPixels: (string | null)[][] = [];

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            ctx.clearRect(0, 0, sheetFrameWidth, sheetFrameHeight);
            ctx.drawImage(img, c * sheetFrameWidth, r * sheetFrameHeight, sheetFrameWidth, sheetFrameHeight, 0, 0, sheetFrameWidth, sheetFrameHeight);

            const imgData = ctx.getImageData(0, 0, sheetFrameWidth, sheetFrameHeight);
            const data = imgData.data;
            const pixels: (string | null)[] = [];

            for (let i = 0; i < data.length; i += 4) {
              const rVal = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3];

              if (a < 10) {
                pixels.push(null);
              } else {
                pixels.push(`#${[rVal, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`);
              }
            }
            framesPixels.push(pixels);
          }
        }

        canvas.importFramesToMatrix(canvas.activeMatrixId, framesPixels);
      } else {
        // Multi-row: Each row is a new matrix
        for (let r = 0; r < rows; r++) {
          const framesPixels: (string | null)[][] = [];

          for (let c = 0; c < cols; c++) {
            ctx.clearRect(0, 0, sheetFrameWidth, sheetFrameHeight);
            ctx.drawImage(img, c * sheetFrameWidth, r * sheetFrameHeight, sheetFrameWidth, sheetFrameHeight, 0, 0, sheetFrameWidth, sheetFrameHeight);

            const imgData = ctx.getImageData(0, 0, sheetFrameWidth, sheetFrameHeight);
            const data = imgData.data;
            const pixels: (string | null)[] = [];

            for (let i = 0; i < data.length; i += 4) {
              const rVal = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              const a = data[i + 3];

              if (a < 10) {
                pixels.push(null);
              } else {
                pixels.push(`#${[rVal, g, b].map(v => v.toString(16).padStart(2, "0")).join("")}`);
              }
            }
            framesPixels.push(pixels);
          }

          canvas.importFramesToMatrix("new", framesPixels);
        }
      }

      setIsImportModalOpen(false);
      setImportedFile(null);
      setImportedImgSrc(null);
    };
    img.src = importedImgSrc;
  };

  // Confirm GIF Import
  const handleImportGIFConfirm = async () => {
    if (!importedFile) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const parsedGif = parseGIF(buffer);
        const gifFrames = decompressFrames(parsedGif, true);

        if (gifFrames.length === 0) {
          alert("No frames found in GIF.");
          return;
        }

        const gifWidth = parsedGif.lsd.width;
        const gifHeight = parsedGif.lsd.height;

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = gifWidth;
        tempCanvas.height = gifHeight;
        const tempCtx = tempCanvas.getContext("2d")!;

        const resizeCanvas = document.createElement("canvas");
        resizeCanvas.width = canvas.width;
        resizeCanvas.height = canvas.height;
        const resizeCtx = resizeCanvas.getContext("2d")!;
        resizeCtx.imageSmoothingEnabled = false;

        const importedPixelFrames: (string | null)[][] = [];

        gifFrames.forEach((gf: any) => {
          const patchData = tempCtx.createImageData(gf.dims.width, gf.dims.height);
          patchData.data.set(gf.patch);

          const patchCanvas = document.createElement("canvas");
          patchCanvas.width = gf.dims.width;
          patchCanvas.height = gf.dims.height;
          patchCanvas.getContext("2d")!.putImageData(patchData, 0, 0);

          tempCtx.drawImage(patchCanvas, gf.dims.left, gf.dims.top);

          resizeCtx.clearRect(0, 0, canvas.width, canvas.height);
          resizeCtx.drawImage(tempCanvas, 0, 0, canvas.width, canvas.height);

          const fullData = resizeCtx.getImageData(0, 0, canvas.width, canvas.height);
          const data = fullData.data;
          const pixelArray: (string | null)[] = [];

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];

            if (a < 10) {
              pixelArray.push(null);
            } else {
              const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
              pixelArray.push(hex);
            }
          }
          importedPixelFrames.push(pixelArray);
        });

        canvas.importFramesToMatrix(gifTargetMatrixId, importedPixelFrames);
      } catch (err) {
        console.error(err);
        alert("Failed to parse GIF. Please ensure it is a valid file.");
      }
    };
    reader.readAsArrayBuffer(importedFile);
    setIsImportModalOpen(false);
    setImportedFile(null);
  };

  return (
    <>
    <header className="hidden md:flex relative z-30 h-9 shrink-0 items-center border-b border-zinc-950 bg-zinc-800 text-[11px] shadow-[inset_0_-1px_0_#3f3f46]" ref={menuRef}>
      <button
        className="flex h-full items-center border-r border-zinc-950 px-4 font-ui text-[14px] font-black uppercase tracking-widest text-amber-300 hover:bg-zinc-700 hover:text-amber-200"
        onClick={onNavigateHome}
        type="button"
      >
        MAKE PIXEL DOT
      </button>

      <nav className="flex h-full items-center">
        {/* 1. Project Menu */}
        <div className="relative h-full">
          <button
            className={`h-full w-20 border-r border-zinc-950 px-3 font-ui font-semibold text-zinc-200 hover:bg-zinc-700 active:bg-zinc-950 ${activeMenu === "Project" ? "bg-zinc-950 text-amber-300" : ""}`}
            onClick={() => handleMenuClick("Project")}
            type="button"
          >
            Project
          </button>
          {activeMenu === "Project" && (
            <div className="absolute left-0 top-9 w-44 border border-zinc-950 bg-zinc-800 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
              <button
                className="w-full px-4 py-2 text-left font-ui text-zinc-200 hover:bg-zinc-700 hover:text-white"
                onClick={() => {
                  setIsNewModalOpen(true);
                  setActiveMenu(null);
                }}
                type="button"
              >
                New Project...
              </button>
              <button
                className="w-full px-4 py-2 text-left font-ui text-zinc-200 hover:bg-zinc-700 hover:text-white"
                onClick={handleClearCanvas}
                type="button"
              >
                Clear Project
              </button>
              <hr className="border-zinc-950 my-1" />
              <button
                className="w-full px-4 py-2 text-left font-ui text-zinc-200 hover:bg-zinc-700 hover:text-white"
                onClick={handleLoadProjectClick}
                type="button"
              >
                Load Project (.dotproj)
              </button>
              <button
                className="w-full px-4 py-2 text-left font-ui text-zinc-200 hover:bg-zinc-700 hover:text-white"
                onClick={handleSaveProject}
                type="button"
              >
                Save Project (.dotproj)
              </button>
            </div>
          )}
        </div>

        {/* 2. Save Menu */}
        <div className="relative h-full">
          <button
            className={`h-full w-20 border-r border-zinc-950 px-3 font-ui font-semibold text-zinc-200 hover:bg-zinc-700 active:bg-zinc-950 ${activeMenu === "Save" ? "bg-zinc-950 text-amber-300" : ""}`}
            onClick={() => handleMenuClick("Save")}
            type="button"
          >
            {t.save}
          </button>
          {activeMenu === "Save" && (
            <div className="absolute left-0 top-9 w-48 border border-zinc-950 bg-zinc-800 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
              <button
                className="w-full px-4 py-2 text-left font-ui text-zinc-200 hover:bg-zinc-700 hover:text-white"
                onClick={() => {
                  setIsExportPNGOpen(true);
                  setActiveMenu(null);
                }}
                type="button"
              >
                {t.savePng}
              </button>
              <button
                className="w-full px-4 py-2 text-left font-ui text-zinc-200 hover:bg-zinc-700 hover:text-white"
                onClick={() => {
                  setIsExportGIFOpen(true);
                  setActiveMenu(null);
                }}
                type="button"
              >
                {t.saveGif}
              </button>
              <button
                className="w-full px-4 py-2 text-left font-ui text-zinc-200 hover:bg-zinc-700 hover:text-white"
                onClick={() => {
                  setIsExportSpritesheetOpen(true);
                  setActiveMenu(null);
                }}
                type="button"
              >
                {t.saveSpritesheet}
              </button>
              <hr className="border-zinc-950 my-1" />
              <button
                className="w-full px-4 py-2 text-left font-ui text-zinc-200 hover:bg-zinc-700 hover:text-white"
                onClick={handleImportFileClick}
                type="button"
              >
                {t.importImageGif}
              </button>
            </div>
          )}
        </div>

        {/* 3. Setting Menu */}
        <div className="relative h-full">
          <button
            className={`h-full w-20 border-r border-zinc-950 px-3 font-ui font-semibold text-zinc-200 hover:bg-zinc-700 active:bg-zinc-950 ${activeMenu === "Setting" ? "bg-zinc-950 text-amber-300" : ""}`}
            onClick={() => handleMenuClick("Setting")}
            type="button"
          >
            {t.setting}
          </button>
          {activeMenu === "Setting" && (
            <div className="absolute left-0 top-9 w-48 border border-zinc-950 bg-zinc-800 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
              <button
                className="w-full px-4 py-2 text-left font-ui text-zinc-200 hover:bg-zinc-700 hover:text-white flex items-center justify-between"
                onClick={() => {
                  setIsSettingOpen(true);
                  setActiveMenu(null);
                }}
                type="button"
              >
                <span>{t.canvasOptions}</span>
                <Settings size={12} />
              </button>
            </div>
          )}
        </div>

        {/* 4. Help Menu */}
        <div className="relative h-full">
          <button
            className={`h-full w-20 border-r border-zinc-950 px-3 font-ui font-semibold text-zinc-200 hover:bg-zinc-700 active:bg-zinc-950 ${activeMenu === "Help" ? "bg-zinc-950 text-amber-300" : ""}`}
            onClick={() => handleMenuClick("Help")}
            type="button"
          >
            {t.help}
          </button>
          {activeMenu === "Help" && (
            <div className="absolute left-0 top-9 w-44 border border-zinc-950 bg-zinc-800 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
              <button
                className="w-full px-4 py-2 text-left font-ui text-zinc-200 hover:bg-zinc-700 hover:text-white flex items-center justify-between"
                onClick={() => {
                  setIsHelpOpen(true);
                  setActiveMenu(null);
                }}
                type="button"
              >
                <span>{t.shortcutsInfo}</span>
                <HelpCircle size={12} />
              </button>
              <hr className="border-zinc-950 my-1" />
              <a
                href="/guide.html"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-4 py-2 text-left font-ui text-zinc-200 hover:bg-zinc-700 hover:text-white"
                onClick={() => setActiveMenu(null)}
              >
                {t.guideFaq}
              </a>
              <a
                href="/about.html"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-4 py-2 text-left font-ui text-zinc-200 hover:bg-zinc-700 hover:text-white"
                onClick={() => setActiveMenu(null)}
              >
                {t.aboutContact}
              </a>
              <a
                href="/privacy.html"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-4 py-2 text-left font-ui text-zinc-200 hover:bg-zinc-700 hover:text-white"
                onClick={() => setActiveMenu(null)}
              >
                {t.privacyPolicy}
              </a>
              <a
                href="/terms.html"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full px-4 py-2 text-left font-ui text-zinc-200 hover:bg-zinc-700 hover:text-white"
                onClick={() => setActiveMenu(null)}
              >
                {t.termsService}
              </a>
            </div>
          )}
        </div>
      </nav>

      <div className="ml-auto flex h-full items-center gap-2 border-l border-zinc-950 px-3 font-ui text-[10px] text-zinc-400">
        <LanguageToggle language={language} onChange={onLanguageChange} />
        <span>{t.project} {canvas.width} x {canvas.height}</span>
        <span className="h-2 w-2 bg-emerald-400 animate-pulse rounded-full" />
      </div>
    </header>

      {/* Hidden inputs */}
      <input
        accept=".dotproj"
        className="hidden"
        onChange={handleProjectFileChange}
        onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
        ref={projectInputRef}
        type="file"
      />
      <input
        accept="image/png, image/jpeg, image/jpg, image/gif"
        className="hidden"
        onChange={handleFileChange}
        onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
        ref={fileInputRef}
        type="file"
      />

      {/* Modal 1: New Project Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-[1px]">
          <div className="w-80 border border-zinc-950 bg-zinc-900 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.6)] text-zinc-100 rounded">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-950 pb-2 font-pixel text-[13px] text-amber-300 uppercase">
              <span>New Project</span>
              <button
                className="h-5 w-5 border border-zinc-950 bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                onClick={() => setIsNewModalOpen(false)}
                type="button"
              >
                x
              </button>
            </div>

            <div className="flex flex-col gap-3 font-ui text-[12px]">
              <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                <span className="text-zinc-400 font-semibold">Width</span>
                <input
                  className="h-8 border border-zinc-950 bg-zinc-950 px-2 text-zinc-100 outline-none focus:border-amber-300 rounded"
                  type="number"
                  min={4}
                  max={256}
                  value={newWidth}
                  onChange={(e) => setNewWidth(Number(e.target.value))}
                />
              </div>
              <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                <span className="text-zinc-400 font-semibold">Height</span>
                <input
                  className="h-8 border border-zinc-950 bg-zinc-950 px-2 text-zinc-100 outline-none focus:border-amber-300 rounded"
                  type="number"
                  min={4}
                  max={256}
                  value={newHeight}
                  onChange={(e) => setNewHeight(Number(e.target.value))}
                />
              </div>

              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                {[16, 32, 64, 128, 256].map((size) => (
                  <button
                    key={size}
                    type="button"
                    className="h-8 border border-zinc-950 bg-zinc-800 hover:bg-zinc-700 font-semibold text-zinc-300 rounded"
                    onClick={() => {
                      setNewWidth(size);
                      setNewHeight(size);
                    }}
                  >
                    {size}x{size}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  className="h-9 border border-zinc-950 bg-zinc-700 font-bold hover:bg-zinc-600 shadow-pixel rounded"
                  onClick={() => setIsNewModalOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="h-9 border border-zinc-950 bg-blue-600 font-bold text-white hover:bg-blue-500 shadow-pixel rounded"
                  onClick={handleNewCanvas}
                  type="button"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Save as PNG (Frame selection) */}
      {isExportPNGOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-[1px]">
          <div className="w-[360px] border border-zinc-950 bg-zinc-900 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.6)] text-zinc-100 rounded">
            <div className="mb-3 flex items-center justify-between border-b border-zinc-950 pb-2 font-pixel text-[13px] text-amber-300 uppercase">
              <span>Save as PNG</span>
              <button
                className="h-5 w-5 border border-zinc-950 bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                onClick={() => setIsExportPNGOpen(false)}
                type="button"
              >
                x
              </button>
            </div>

            <div className="flex flex-col gap-4 font-ui text-[12px]">
              <div>
                <span className="text-zinc-400 font-semibold block mb-2">Select Frame to Export</span>
                {/* Horizontal Scrollable Frame List with canvas previews */}
                <div className="flex gap-2 overflow-x-auto pb-2 min-h-[86px] scrollbar-thin select-none">
                  {canvas.frames.map((frame, index) => {
                    const isSelected = frame.id === selectedPNGFrameId;
                    return (
                      <div
                        key={frame.id}
                        onClick={() => setSelectedPNGFrameId(frame.id)}
                        className={`flex flex-col items-center gap-1.5 p-1.5 border rounded cursor-pointer transition-colors ${
                          isSelected
                            ? "border-amber-300 bg-amber-300/10 text-amber-300 font-bold"
                            : "border-zinc-800 bg-zinc-950/20 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                        }`}
                      >
                        <FrameThumbnail frame={frame} layers={canvas.layers} width={canvas.width} height={canvas.height} canvas={canvas} />
                        <span className="text-[10px]">Frame {index + 1}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-zinc-400 font-semibold block mb-2">Scale Factor (Multiplier)</span>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 4, 8, 16, 32].map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      className={`h-8 border rounded font-semibold ${
                        exportScale === scale
                          ? "border-amber-300 bg-amber-300/10 text-amber-300"
                          : "border-zinc-950 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                      }`}
                      onClick={() => setExportScale(scale)}
                    >
                      {scale}x
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-zinc-500 mt-2">
                  Final Output Size: {canvas.width * exportScale} x {canvas.height * exportScale} px
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  className="h-9 border border-zinc-950 bg-zinc-700 font-bold hover:bg-zinc-600 shadow-pixel rounded"
                  onClick={() => setIsExportPNGOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="h-9 border border-zinc-950 bg-blue-600 font-bold text-white hover:bg-blue-500 shadow-pixel rounded"
                  onClick={handleExportPNGSubmit}
                  type="button"
                >
                  Save PNG
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Save as GIF (Select matrix) */}
      {isExportGIFOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-[1px]">
          <div className="w-80 border border-zinc-950 bg-zinc-900 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.6)] text-zinc-100 rounded">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-950 pb-2 font-pixel text-[13px] text-amber-300 uppercase">
              <span>Save as GIF</span>
              <button
                className="h-5 w-5 border border-zinc-950 bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                onClick={() => setIsExportGIFOpen(false)}
                type="button"
              >
                x
              </button>
            </div>

            <div className="flex flex-col gap-4 font-ui text-[12px]">
              <div>
                <span className="text-zinc-400 font-semibold block mb-1.5">Select Animation (Matrix)</span>
                <select
                  value={selectedGIFMatrixId}
                  onChange={(e) => setSelectedGIFMatrixId(e.target.value)}
                  className="w-full h-8 px-2 border border-zinc-950 bg-zinc-950 text-zinc-200 rounded outline-none focus:border-amber-300"
                >
                  {canvas.matrices.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.frames.length} frames)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="text-zinc-400 font-semibold block mb-2">Scale Factor (Multiplier)</span>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 4, 8, 16, 32].map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      className={`h-8 border rounded font-semibold ${
                        exportScale === scale
                          ? "border-amber-300 bg-amber-300/10 text-amber-300"
                          : "border-zinc-950 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                      }`}
                      onClick={() => setExportScale(scale)}
                    >
                      {scale}x
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-zinc-500 mt-2">
                  Output Dimensions: {canvas.width * exportScale} x {canvas.height * exportScale} px. Playback: {canvas.fps} FPS.
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  className="h-9 border border-zinc-950 bg-zinc-700 font-bold hover:bg-zinc-600 shadow-pixel rounded"
                  onClick={() => setIsExportGIFOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="h-9 border border-zinc-950 bg-blue-600 font-bold text-white hover:bg-blue-500 shadow-pixel rounded"
                  onClick={handleExportGIFSubmit}
                  type="button"
                >
                  Save GIF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Save as Spritesheet */}
      {isExportSpritesheetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-[1px]">
          <div className="w-80 border border-zinc-950 bg-zinc-900 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.6)] text-zinc-100 rounded">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-950 pb-2 font-pixel text-[13px] text-amber-300 uppercase">
              <span>Save as Spritesheet</span>
              <button
                className="h-5 w-5 border border-zinc-950 bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                onClick={() => setIsExportSpritesheetOpen(false)}
                type="button"
              >
                x
              </button>
            </div>

            <div className="flex flex-col gap-4 font-ui text-[12px]">
              <div>
                <span className="text-zinc-400 font-semibold block mb-2">Scale Factor (Multiplier)</span>
                <div className="grid grid-cols-5 gap-1.5">
                  {[1, 4, 8, 16, 32].map((scale) => (
                    <button
                      key={scale}
                      type="button"
                      className={`h-8 border rounded font-semibold ${
                        exportScale === scale
                          ? "border-amber-300 bg-amber-300/10 text-amber-300"
                          : "border-zinc-950 bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                      }`}
                      onClick={() => setExportScale(scale)}
                    >
                      {scale}x
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-zinc-950 border border-zinc-950 p-2.5 rounded text-zinc-300 leading-relaxed">
                <div className="font-semibold text-zinc-400 text-[10px] uppercase mb-1">Layout Preview</div>
                <div className="flex justify-between">
                  <span>Rows (Animations):</span>
                  <span>{canvas.matrices.length} (Row per Matrix)</span>
                </div>
                <div className="flex justify-between mt-0.5">
                  <span>Columns (Max frames):</span>
                  <span>{Math.max(...canvas.matrices.map((m) => m.frames.length), 1)}</span>
                </div>
                <div className="flex justify-between mt-0.5 font-bold text-amber-300">
                  <span>Final Size:</span>
                  <span>
                    {Math.max(...canvas.matrices.map((m) => m.frames.length), 1) * canvas.width * exportScale} x {canvas.matrices.length * canvas.height * exportScale} px
                  </span>
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  className="h-9 border border-zinc-950 bg-zinc-700 font-bold hover:bg-zinc-600 shadow-pixel rounded"
                  onClick={() => setIsExportSpritesheetOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="h-9 border border-zinc-950 bg-blue-600 font-bold text-white hover:bg-blue-500 shadow-pixel rounded"
                  onClick={handleExportSpritesheetSubmit}
                  type="button"
                >
                  Save Spritesheet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: Import File Options & Parameter Modal */}
      {isImportModalOpen && importedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-[1px]">
          <div className="w-[340px] border border-zinc-950 bg-zinc-900 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.6)] text-zinc-100 rounded">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-950 pb-2 font-pixel text-[13px] text-amber-300 uppercase">
              <span>Import File: {importedFile.name}</span>
              <button
                className="h-5 w-5 border border-zinc-950 bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportedFile(null);
                  setImportedImgSrc(null);
                }}
                type="button"
              >
                x
              </button>
            </div>

            <div className="flex flex-col gap-3 font-ui text-[12px]">
              {/* Image Choose state (let user pick Single Frame or Spritesheet) */}
              {importType === "image-choose" && (
                <div className="flex flex-col gap-2">
                  <span className="text-zinc-400 font-semibold mb-1">Choose Import Mode</span>
                  <button
                    onClick={() => setImportType("single-image")}
                    className="w-full py-2.5 border border-zinc-950 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 rounded font-bold transition-all shadow-pixel"
                  >
                    Import as Single Frame
                  </button>
                  <button
                    onClick={() => setImportType("spritesheet")}
                    className="w-full py-2.5 border border-zinc-950 bg-zinc-800 text-zinc-100 hover:bg-zinc-700 rounded font-bold transition-all shadow-pixel"
                  >
                    Import as Spritesheet (Slices)
                  </button>
                </div>
              )}

              {/* Single Image Options */}
              {importType === "single-image" && (
                <div className="flex flex-col gap-3">
                  <div className="bg-zinc-950 border border-zinc-950 p-2 rounded text-[11px] text-zinc-400 flex flex-col gap-0.5">
                    <span>File size: {importedFile.size} bytes</span>
                    <span>Image scale check...</span>
                  </div>

                  <div>
                    <span className="text-zinc-400 font-semibold block mb-1.5">Import Option</span>
                    <div className="flex flex-col gap-2">
                      <label className={`flex items-center gap-2 p-2 border cursor-pointer rounded ${importFitOption === "original" ? "border-amber-300 bg-amber-300/5 text-amber-300" : "border-zinc-950 bg-zinc-800 text-zinc-400"}`}>
                        <input
                          type="radio"
                          name="single-import-opt"
                          checked={importFitOption === "original"}
                          onChange={() => setImportFitOption("original")}
                          className="accent-amber-300"
                        />
                        <div>
                          <div className="font-bold">Resize Canvas to Image</div>
                          <div className="text-[10px] text-zinc-500">Create new canvas with image dimensions.</div>
                        </div>
                      </label>

                      <label className={`flex items-center gap-2 p-2 border cursor-pointer rounded ${importFitOption === "fit" ? "border-amber-300 bg-amber-300/5 text-amber-300" : "border-zinc-950 bg-zinc-800 text-zinc-400"}`}>
                        <input
                          type="radio"
                          name="single-import-opt"
                          checked={importFitOption === "fit"}
                          onChange={() => setImportFitOption("fit")}
                          className="accent-amber-300"
                        />
                        <div>
                          <div className="font-bold">Fit to Current Canvas</div>
                          <div className="text-[10px] text-zinc-500">Scale to current {canvas.width}x{canvas.height} canvas as new frame.</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      className="h-8 border border-zinc-950 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 font-semibold"
                      onClick={() => setImportType("image-choose")}
                      type="button"
                    >
                      Back
                    </button>
                    <button
                      className="h-8 border border-zinc-950 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold"
                      onClick={handleImportPNGConfirm}
                      type="button"
                    >
                      Confirm Import
                    </button>
                  </div>
                </div>
              )}

              {/* Spritesheet Options */}
              {importType === "spritesheet" && (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-zinc-400 font-semibold text-[10px]">Frame Width (px)</span>
                      <input
                        type="number"
                        className="h-8 border border-zinc-950 bg-zinc-950 px-2 rounded outline-none text-zinc-200 focus:border-amber-300"
                        value={sheetFrameWidth}
                        onChange={(e) => setSheetFrameWidth(Number(e.target.value))}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-zinc-400 font-semibold text-[10px]">Frame Height (px)</span>
                      <input
                        type="number"
                        className="h-8 border border-zinc-950 bg-zinc-950 px-2 rounded outline-none text-zinc-200 focus:border-amber-300"
                        value={sheetFrameHeight}
                        onChange={(e) => setSheetFrameHeight(Number(e.target.value))}
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-zinc-400 font-semibold block mb-1.5">Slicing Method</span>
                    <div className="flex flex-col gap-2">
                      <label className={`flex items-center gap-2 p-2 border cursor-pointer rounded ${sheetImportMethod === "single" ? "border-amber-300 bg-amber-300/5 text-amber-300" : "border-zinc-950 bg-zinc-800 text-zinc-400"}`}>
                        <input
                          type="radio"
                          name="sheet-import-meth"
                          checked={sheetImportMethod === "single"}
                          onChange={() => setSheetImportMethod("single")}
                          className="accent-amber-300"
                        />
                        <div>
                          <div className="font-bold">Sequentially to Active Matrix</div>
                          <div className="text-[10px] text-zinc-500">Append all frames onto the current animation row.</div>
                        </div>
                      </label>

                      <label className={`flex items-center gap-2 p-2 border cursor-pointer rounded ${sheetImportMethod === "multi" ? "border-amber-300 bg-amber-300/5 text-amber-300" : "border-zinc-950 bg-zinc-800 text-zinc-400"}`}>
                        <input
                          type="radio"
                          name="sheet-import-meth"
                          checked={sheetImportMethod === "multi"}
                          onChange={() => setSheetImportMethod("multi")}
                          className="accent-amber-300"
                        />
                        <div>
                          <div className="font-bold">Create new Matrix per Row</div>
                          <div className="text-[10px] text-zinc-500">Each row of sheet becomes a separate animation matrix.</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      className="h-8 border border-zinc-950 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 font-semibold"
                      onClick={() => setImportType("image-choose")}
                      type="button"
                    >
                      Back
                    </button>
                    <button
                      className="h-8 border border-zinc-950 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold"
                      onClick={handleImportSpritesheetConfirm}
                      type="button"
                    >
                      Unpack & Import
                    </button>
                  </div>
                </div>
              )}

              {/* GIF Options */}
              {importType === "gif" && (
                <div className="flex flex-col gap-3">
                  <div>
                    <span className="text-zinc-400 font-semibold block mb-1.5">Target Animation (Matrix)</span>
                    <select
                      value={gifTargetMatrixId}
                      onChange={(e) => setGifTargetMatrixId(e.target.value)}
                      className="w-full h-8 px-2 border border-zinc-950 bg-zinc-950 text-zinc-200 rounded outline-none focus:border-amber-300 font-ui text-[12px]"
                    >
                      <option value="new">+ Create New Matrix</option>
                      {canvas.matrices.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (Append frames)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="text-[10px] text-zinc-500 italic mt-1 leading-relaxed">
                    GIF frames will be decoded client-side and automatically adapted to the canvas size ({canvas.width}x{canvas.height}).
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      className="h-8 border border-zinc-950 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 font-semibold"
                      onClick={() => {
                        setIsImportModalOpen(false);
                        setImportedFile(null);
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="h-8 border border-zinc-950 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold"
                      onClick={handleImportGIFConfirm}
                      type="button"
                    >
                      Decode & Import
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Setting Modal */}
      {isSettingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 backdrop-blur-[1px]">
          <div className="flex max-h-[92dvh] w-full max-w-lg flex-col border border-zinc-950 bg-zinc-900 p-4 text-zinc-100 shadow-[0_16px_40px_rgba(0,0,0,0.6)]">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-950 pb-2 font-pixel text-[13px] text-amber-300 uppercase">
              <span>Settings</span>
              <button
                className="h-5 w-5 border border-zinc-950 bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                onClick={() => setIsSettingOpen(false)}
                type="button"
              >
                x
              </button>
            </div>

            <div className="flex flex-col gap-3 overflow-y-auto pr-1 font-ui text-[12px] scrollbar-thin">
              <div className="bg-zinc-950 p-3 border border-zinc-950 rounded text-zinc-400">
                <div className="flex justify-between font-bold text-zinc-300 border-b border-zinc-900 pb-1 mb-1">
                  <span>Current Canvas</span>
                  <span className="text-amber-300 font-mono">{canvas.width} x {canvas.height} px</span>
                </div>
                <div>Matrices: {canvas.matrices.length}</div>
                <div>Layers: {canvas.layers.length}</div>
              </div>

              <div className="border-t border-zinc-800 pt-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-bold text-zinc-300 uppercase tracking-wider text-[10px]">
                    Canvas Size
                  </div>
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400">
                    <input
                      checked={isAspectLocked}
                      className="h-3 w-3 accent-amber-300"
                      onChange={(event) => setIsAspectLocked(event.target.checked)}
                      type="checkbox"
                    />
                    Lock ratio
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-7">
                  {[16, 24, 32, 48, 64, 128, 256].map((size) => (
                    <button
                      className={`h-8 border px-2 font-mono text-[10px] font-bold hover:bg-zinc-700 ${
                        settingsWidth === size && settingsHeight === size
                          ? "border-amber-300 bg-amber-300/10 text-amber-300"
                          : "border-zinc-950 bg-zinc-800 text-zinc-300"
                      }`}
                      key={size}
                      onClick={() => setSettingsCanvasSize(size, size)}
                      type="button"
                    >
                      {size} x {size}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                  <label className="min-w-0">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Width</span>
                    <input
                      className="h-8 w-full border border-zinc-950 bg-zinc-950 px-2 font-mono text-[11px] text-zinc-100 outline-none focus:border-amber-300"
                      max={256}
                      min={4}
                      onChange={(event) => handleSettingsWidthChange(Number(event.target.value))}
                      type="number"
                      value={settingsWidth}
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">Height</span>
                    <input
                      className="h-8 w-full border border-zinc-950 bg-zinc-950 px-2 font-mono text-[11px] text-zinc-100 outline-none focus:border-amber-300"
                      max={256}
                      min={4}
                      onChange={(event) => handleSettingsHeightChange(Number(event.target.value))}
                      type="number"
                      value={settingsHeight}
                    />
                  </label>
                  <button
                    className="h-8 border border-amber-200 bg-amber-300 px-3 text-[10px] font-black uppercase text-zinc-950 shadow-pixel hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={settingsWidth === canvas.width && settingsHeight === canvas.height}
                    onClick={applySettingsCanvasSize}
                    type="button"
                  >
                    Apply
                  </button>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
                  Canvas pixels define the artwork size. Export scale controls the final PNG/GIF dimensions.
                </p>
              </div>

              <div className="border-t border-zinc-800 pt-3">
                <div className="mb-2 font-bold text-zinc-300 uppercase tracking-wider text-[10px]">
                  View
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    className={`h-8 border px-2 text-[10px] font-bold ${
                      onionSkinEnabled
                        ? "border-amber-300 bg-amber-300/10 text-amber-300"
                        : "border-zinc-950 bg-zinc-800 text-zinc-400"
                    }`}
                    onClick={onTogglePreviousFrame}
                    type="button"
                  >
                    Previous Frame
                  </button>
                  <button
                    className={`h-8 border px-2 text-[10px] font-bold ${
                      canvas.dimInactiveLayers
                        ? "border-amber-300 bg-amber-300/10 text-amber-300"
                        : "border-zinc-950 bg-zinc-800 text-zinc-400"
                    }`}
                    onClick={() => canvas.setDimInactiveLayers(!canvas.dimInactiveLayers)}
                    type="button"
                  >
                    {canvas.dimInactiveLayers ? "Merged View" : "Active Only"}
                  </button>
                </div>
              </div>

              {/* Keyboard Shortcuts Customizer */}
              <div className="border-t border-zinc-850 pt-3">
                <div className="mb-2 font-bold text-zinc-300 uppercase tracking-wider text-[10px] flex items-center justify-between">
                  <span>Customize Shortcuts</span>
                  <button
                    type="button"
                    onClick={canvas.resetShortcuts}
                    className="text-zinc-500 hover:text-amber-300 underline font-normal text-[9px] lowercase"
                  >
                    reset to default
                  </button>
                </div>
                <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
                  {shortcutItems.map((item) => {
                    const isRecording = recordingAction === item.id;
                    const currentKey = canvas.shortcuts?.[item.id] || "";
                    return (
                      <div key={item.id} className="flex items-center justify-between bg-zinc-950/60 p-2 border border-zinc-950 rounded">
                        <span className="text-zinc-300 font-medium text-[11px]">{item.label}</span>
                        <button
                          type="button"
                          onClick={() => setRecordingAction(isRecording ? null : item.id)}
                          className={`h-7 px-3 border rounded text-[10px] font-mono font-bold transition-all shadow-pixel ${
                            isRecording
                              ? "border-amber-300 bg-amber-300/10 text-amber-300 animate-pulse"
                              : "border-zinc-800 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                          }`}
                        >
                          {isRecording ? "Press a key..." : currentKey.toUpperCase() || "NONE"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-[10px] text-zinc-500 italic leading-relaxed border-t border-zinc-850 pt-2">
                Desktop timeline still provides advanced frame and cel-link controls.
              </div>

              <button
                className="h-9 mt-2 border border-zinc-950 bg-zinc-700 font-bold hover:bg-zinc-600 shadow-pixel rounded"
                onClick={() => setIsSettingOpen(false)}
                type="button"
              >
                Close Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {isHelpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-[1px]">
          <div className="w-96 border border-zinc-950 bg-zinc-900 p-4 shadow-[0_16px_40px_rgba(0,0,0,0.6)] text-zinc-100 rounded">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-950 pb-2 font-pixel text-[13px] text-amber-300 uppercase">
              <span>Shortcuts & Help</span>
              <button
                className="h-5 w-5 border border-zinc-950 bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                onClick={() => setIsHelpOpen(false)}
                type="button"
              >
                x
              </button>
            </div>

            <div className="flex flex-col gap-3.5 font-ui text-[12px] max-h-96 overflow-y-auto pr-1 scrollbar-thin">
              <div>
                <span className="font-bold text-amber-300 border-b border-zinc-950 pb-1 block mb-1.5">Keyboard Shortcuts</span>
                <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-1 font-mono text-[11px] text-zinc-400">
                  <span className="text-zinc-300 font-bold">B</span> <span>Pencil Tool</span>
                  <span className="text-zinc-300 font-bold">E</span> <span>Eraser Tool</span>
                  <span className="text-zinc-300 font-bold">G</span> <span>Bucket Fill Tool</span>
                  <span className="text-zinc-300 font-bold">I</span> <span>Eyedropper Tool</span>
                  <span className="text-zinc-300 font-bold">L</span> <span>Line Tool</span>
                  <span className="text-zinc-300 font-bold">R</span> <span>Rectangle Tool</span>
                  <span className="text-zinc-300 font-bold">O</span> <span>Ellipse Tool</span>
                  <span className="text-zinc-300 font-bold">U / J</span> <span>Lighten / Darken</span>
                  <span className="text-zinc-300 font-bold">M</span> <span>Selection Tool</span>
                  <span className="text-zinc-300 font-bold">[ / ]</span> <span>Brush Size - / +</span>
                  <span className="text-zinc-300 font-bold">Ctrl + C</span> <span>Copy selected pixels</span>
                  <span className="text-zinc-300 font-bold">Ctrl + V</span> <span>Stamp copied pixels</span>
                  <span className="text-zinc-300 font-bold">Ctrl + X</span> <span>Cut selected pixels</span>
                  <span className="text-zinc-300 font-bold">Shift + Drag</span> <span>Move selection pixels</span>
                  <span className="text-zinc-300 font-bold">Ctrl + Z</span> <span>Undo</span>
                  <span className="text-zinc-300 font-bold">Ctrl + Y</span> <span>Redo</span>
                  <span className="text-zinc-300 font-bold">Space + Drag</span> <span>Pan Canvas</span>
                  <span className="text-zinc-300 font-bold">Scroll Wheel</span> <span>Zoom Canvas</span>
                </div>
              </div>

              <div>
                <span className="font-bold text-amber-300 border-b border-zinc-950 pb-1 block mb-1.5">Selection Tool</span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Drag to create a selection. Drag inside it to move only the box, or use Shift + drag to move the pixels with it. On touch devices, turn on the Move button in the selection toolbar instead of holding Shift.
                </p>
              </div>

              <div>
                <span className="font-bold text-amber-300 border-b border-zinc-950 pb-1 block mb-1.5">Multi-Matrix Design</span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Each matrix represents a separate animation sequence, such as Idle or Walk. Spritesheet export arranges those sequences in order for asset output.
                </p>
              </div>

              <div>
                <span className="font-bold text-amber-300 border-b border-zinc-950 pb-1 block mb-1.5">Drag and Drop (DND)</span>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Drag frame headers in the timeline or layer items in the layer panel to reorder them.
                </p>
              </div>
            </div>

            <button
              className="h-9 mt-4 w-full border border-zinc-950 bg-zinc-700 font-bold hover:bg-zinc-600 shadow-pixel rounded"
              onClick={() => setIsHelpOpen(false)}
              type="button"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* Mobile Header */}
      <header className="md:hidden relative z-30 flex h-10 shrink-0 items-center justify-between border-b border-zinc-950 bg-zinc-800 px-3 text-[11px] text-zinc-200 select-none">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="grid h-8 w-8 place-items-center border border-zinc-950 bg-zinc-900 text-zinc-300 active:bg-zinc-700"
          aria-label={t.openMenu}
          type="button"
        >
          <Menu size={18} />
        </button>
        <button
          className="font-ui text-[13px] font-black uppercase tracking-widest text-amber-300"
          onClick={onNavigateHome}
          type="button"
        >
          MAKE PIXEL DOT
        </button>
        <button
          onClick={() => setIsSettingOpen(true)}
          className="grid h-8 w-8 place-items-center border border-zinc-950 bg-zinc-900 text-zinc-300 active:bg-zinc-700"
          aria-label={t.openSettings}
          type="button"
        >
          <Settings size={16} />
        </button>
      </header>

      {/* Mobile Menu Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          {/* Content */}
          <div className="relative w-[min(82vw,18rem)] bg-zinc-900 border-r border-zinc-950 flex flex-col h-full text-zinc-200 p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-950 pb-2 mb-4">
              <span className="font-ui font-black text-amber-300 text-[13px] uppercase tracking-widest">{t.menu}</span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-zinc-400 hover:text-white"
                type="button"
              >
                x
              </button>
            </div>
            
            <div className="flex flex-col gap-1.5 overflow-y-auto text-[12px] font-ui scrollbar-none">
              <LanguageToggle language={language} onChange={onLanguageChange} />
              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mb-1 mt-3">{t.project}</div>
              <button
                onClick={() => {
                  setIsNewModalOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left py-2 px-3 bg-zinc-950/40 hover:bg-zinc-800 rounded border border-zinc-950"
                type="button"
              >
                {t.newProject}
              </button>
              <button
                onClick={() => {
                  handleClearCanvas();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left py-2 px-3 bg-zinc-950/40 hover:bg-zinc-800 rounded border border-zinc-950 text-red-400"
                type="button"
              >
                {t.clearProject}
              </button>
              <button
                onClick={() => {
                  handleLoadProjectClick();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left py-2 px-3 bg-zinc-950/40 hover:bg-zinc-800 rounded border border-zinc-950"
                type="button"
              >
                {t.loadProject}
              </button>
              <button
                onClick={() => {
                  handleSaveProject();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left py-2 px-3 bg-zinc-950/40 hover:bg-zinc-800 rounded border border-zinc-950"
                type="button"
              >
                {t.saveProject}
              </button>

              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-4 mb-1">Export / Import</div>
              <button
                onClick={() => {
                  setIsExportPNGOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left py-2 px-3 bg-zinc-950/40 hover:bg-zinc-800 rounded border border-zinc-950"
                type="button"
              >
                {t.savePng}
              </button>
              <button
                onClick={() => {
                  setIsExportGIFOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left py-2 px-3 bg-zinc-950/40 hover:bg-zinc-800 rounded border border-zinc-950"
                type="button"
              >
                {t.saveGif}
              </button>
              <button
                onClick={() => {
                  setIsExportSpritesheetOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left py-2 px-3 bg-zinc-950/40 hover:bg-zinc-800 rounded border border-zinc-950"
                type="button"
              >
                {t.saveSpritesheet}
              </button>
              <button
                onClick={() => {
                  handleImportFileClick();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left py-2 px-3 bg-zinc-950/40 hover:bg-zinc-800 rounded border border-zinc-950"
                type="button"
              >
                {t.importImageGif}
              </button>

              <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-4 mb-1">{t.informationPolicies}</div>
              <button
                onClick={() => {
                  setIsHelpOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left py-2 px-3 bg-zinc-950/40 hover:bg-zinc-800 rounded border border-zinc-950"
                type="button"
              >
                {t.shortcutsInfo}
              </button>
              <a
                href="/guide.html"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full block text-left py-2 px-3 bg-zinc-950/40 hover:bg-zinc-800 rounded border border-zinc-950"
              >
                {t.guideFaq}
              </a>
              <a
                href="/about.html"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full block text-left py-2 px-3 bg-zinc-950/40 hover:bg-zinc-800 rounded border border-zinc-950"
              >
                {t.aboutContact}
              </a>
              <a
                href="/privacy.html"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full block text-left py-2 px-3 bg-zinc-950/40 hover:bg-zinc-800 rounded border border-zinc-950"
              >
                {t.privacyPolicy}
              </a>
              <a
                href="/terms.html"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full block text-left py-2 px-3 bg-zinc-950/40 hover:bg-zinc-800 rounded border border-zinc-950"
              >
                {t.termsService}
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
