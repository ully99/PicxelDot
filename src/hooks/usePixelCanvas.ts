import {
  MouseEvent,
  PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pixel, PixelPoint, Tool, Layer, Frame, Cel, CanvasState, FrameTag, Matrix, SelectionRect, ShortcutAction, Shortcuts } from "../types";
import { useHistory } from "./useHistory";

const DEFAULT_SHORTCUTS: Shortcuts = {
  pencil: "b",
  eraser: "e",
  bucket: "g",
  eyedropper: "i",
  line: "l",
  rectangle: "r",
  ellipse: "o",
  lighten: "u",
  darken: "j",
  selection: "m",
  brushSizeDecrease: "[",
  brushSizeIncrease: "]",
};

const DEFAULT_WIDTH = 32;
const DEFAULT_HEIGHT = 32;

const createDefaultMatrix = (id: string, name: string, w: number, h: number): Matrix => {
  const defaultLayers = [
    {
      id: "default-layer",
      name: "Layer 1",
      visible: true,
    },
  ];
  const defaultCels = [
    {
      layerId: "default-layer",
      pixels: Array.from<Pixel>({ length: w * h }).fill(null),
    },
  ];
  const defaultFrames = [
    {
      id: `frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      cels: defaultCels,
    },
  ];
  return {
    id,
    name,
    layers: defaultLayers,
    frames: defaultFrames,
    tags: [],
  };
};

const createDefaultState = (w: number, h: number): CanvasState => {
  const defaultMatrix = createDefaultMatrix("default-matrix", "Animation 1", w, h);
  return {
    matrices: [defaultMatrix],
    activeMatrixId: "default-matrix",
  };
};

export const resolveCelHelper = (
  state: CanvasState,
  frameId: string,
  layerId: string
): { frameId: string; cel: Cel } | null => {
  let currentFrameId = frameId;
  const visited = new Set<string>();

  // Find the matrix containing currentFrameId
  const matrix = state.matrices.find((m) => m.frames.some((f) => f.id === currentFrameId));
  if (!matrix) return null;

  while (currentFrameId) {
    if (visited.has(currentFrameId)) {
      break; // prevent circular references
    }
    visited.add(currentFrameId);

    const frame = matrix.frames.find((f) => f.id === currentFrameId);
    if (!frame) return null;

    const cel = frame.cels.find((c) => c.layerId === layerId);
    if (!cel) return null;

    if (cel.linkedToFrameId) {
      currentFrameId = cel.linkedToFrameId;
    } else {
      return { frameId: currentFrameId, cel };
    }
  }
  return null;
};

type UsePixelCanvasOptions = {
  initialForeground?: string;
  initialBackground?: string;
};

export function usePixelCanvas({
  initialBackground = "#1d2b53",
  initialForeground = "#ffec27",
}: UsePixelCanvasOptions = {}) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [activeMatrixId, setActiveMatrixIdState] = useState<string>("default-matrix");
  const [activeFrameId, setActiveFrameId] = useState<string>("default-frame");
  const [activeLayerId, setActiveLayerId] = useState<string>("default-layer");

  const history = useHistory<CanvasState>(createDefaultState(DEFAULT_WIDTH, DEFAULT_HEIGHT));

  const [shortcuts, setShortcuts] = useState<Shortcuts>(() => {
    const saved = localStorage.getItem("pixel-dot-shortcuts");
    if (saved) {
      try {
        return { ...DEFAULT_SHORTCUTS, ...JSON.parse(saved) };
      } catch (e) {
        // ignore
      }
    }
    return DEFAULT_SHORTCUTS;
  });

  const updateShortcut = useCallback((action: ShortcutAction, key: string) => {
    setShortcuts((prev) => {
      const updated = { ...prev };
      // Clear key if mapped elsewhere to prevent conflicts
      (Object.keys(updated) as ShortcutAction[]).forEach((act) => {
        if (updated[act].toLowerCase() === key.toLowerCase()) {
          updated[act] = "";
        }
      });
      updated[action] = key;
      localStorage.setItem("pixel-dot-shortcuts", JSON.stringify(updated));
      return updated;
    });
  }, []);

  const resetShortcuts = useCallback(() => {
    setShortcuts(DEFAULT_SHORTCUTS);
    localStorage.setItem("pixel-dot-shortcuts", JSON.stringify(DEFAULT_SHORTCUTS));
  }, []);

  const setActiveMatrixId = useCallback((id: string) => {
    setActiveMatrixIdState(id);
    history.replace({
      ...history.present,
      activeMatrixId: id,
    });
  }, [history]);
  const [activeTool, setActiveTool] = useState<Tool>("pencil");
  const [foreground, setForeground] = useState(initialForeground);
  const [background, setBackground] = useState(initialBackground);
  const [brushSize, setBrushSizeState] = useState(1);
  const [cursorPoint, setCursorPoint] = useState<PixelPoint | null>(null);
  const [selectionRect, setSelectionRect] = useState<SelectionRect | null>(null);
  const [mirrorX, setMirrorX] = useState(false);
  const [mirrorY, setMirrorY] = useState(false);
  const [opacity, setOpacityState] = useState(100);
  const [dimInactiveLayers, setDimInactiveLayers] = useState(false);
  const [copiedFrameData, setCopiedFrameData] = useState<{
    cels: { layerId: string; pixels: Pixel[] }[];
  } | null>(null);
  const [copiedSelectionData, setCopiedSelectionData] = useState<{
    pixels: Pixel[];
    rect: SelectionRect;
  } | null>(null);
  const [showCopiedSelectionStamp, setShowCopiedSelectionStamp] = useState(false);
  const [selectionMoveContentsMode, setSelectionMoveContentsMode] = useState(false);
  const lastPointRef = useRef<PixelPoint | null>(null);
  const shapeStartRef = useRef<PixelPoint | null>(null);
  const shapeBaseStateRef = useRef<CanvasState | null>(null);
  const toneBaseStateRef = useRef<CanvasState | null>(null);
  const toneTouchedPixelsRef = useRef(new Set<number>());
  const selectionStartRef = useRef<PixelPoint | null>(null);
  const selectionMoveBaseStateRef = useRef<CanvasState | null>(null);
  const selectionMoveBaseRectRef = useRef<SelectionRect | null>(null);
  const selectionMoveStartRef = useRef<PixelPoint | null>(null);
  const selectionMoveContentsRef = useRef(false);
  const isMovingSelectionRef = useRef(false);
  const isDrawingRef = useRef(false);
  const strokeColorRef = useRef<Pixel>(initialForeground);
  
  const workingStateRef = useRef<CanvasState>({ matrices: [], activeMatrixId: "" });

  const activeMatrix = useMemo(() => {
    return history.present.matrices.find((m) => m.id === activeMatrixId) || history.present.matrices[0];
  }, [history.present.matrices, activeMatrixId]);

  const activeMatrixLayers = useMemo(() => {
    return activeMatrix ? activeMatrix.layers : [];
  }, [activeMatrix]);

  // Animation playback states
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(6);

  // Synchronize local activeMatrixId state with history when history present changes (e.g. undo/redo, load project)
  useEffect(() => {
    if (history.present.activeMatrixId && history.present.activeMatrixId !== activeMatrixId) {
      const exists = history.present.matrices.some((m) => m.id === history.present.activeMatrixId);
      if (exists) {
        setActiveMatrixIdState(history.present.activeMatrixId);
      }
    }
  }, [history.present.activeMatrixId, activeMatrixId, history.present.matrices]);

  // Auto-correct activeFrameId if it gets deleted or is invalid
  useEffect(() => {
    if (!activeMatrix) return;
    const exists = activeMatrix.frames.some((frame) => frame.id === activeFrameId);
    if (!exists && activeMatrix.frames.length > 0) {
      setActiveFrameId(activeMatrix.frames[0].id);
    }
  }, [activeMatrix, activeFrameId]);

  // Ensure activeLayerId is valid
  useEffect(() => {
    if (activeMatrixLayers.length > 0) {
      const exists = activeMatrixLayers.some((l) => l.id === activeLayerId);
      if (!exists) {
        setActiveLayerId(activeMatrixLayers[0].id);
      }
    }
  }, [activeMatrixLayers, activeLayerId]);

  useEffect(() => {
    if (!isDrawingRef.current) {
      workingStateRef.current = history.present;
    }
  }, [history.present]);

  const isInside = useCallback((x: number, y: number) => {
    return x >= 0 && x < width && y >= 0 && y < height;
  }, [width, height]);

  const toIndex = useCallback((x: number, y: number) => {
    return y * width + x;
  }, [width]);

  const getMirroredPoints = useCallback((point: PixelPoint, mirrorX: boolean, mirrorY: boolean) => {
    const points = [point];

    if (mirrorX) {
      points.push({ x: width - 1 - point.x, y: point.y });
    }

    if (mirrorY) {
      points.push({ x: point.x, y: height - 1 - point.y });
    }

    if (mirrorX && mirrorY) {
      points.push({ x: width - 1 - point.x, y: height - 1 - point.y });
    }

    return points;
  }, [width, height]);

  const getBrushPreviewPoints = useCallback((
    center: PixelPoint,
    brushSize: number,
    mirrorX: boolean,
    mirrorY: boolean,
  ) => {
    const radiusStart = -Math.floor((brushSize - 1) / 2);
    const points = new Map<string, PixelPoint>();

    for (let offsetY = 0; offsetY < brushSize; offsetY += 1) {
      for (let offsetX = 0; offsetX < brushSize; offsetX += 1) {
        const point = {
          x: center.x + radiusStart + offsetX,
          y: center.y + radiusStart + offsetY,
        };

        for (const mirroredPoint of getMirroredPoints(point, mirrorX, mirrorY)) {
          if (isInside(mirroredPoint.x, mirroredPoint.y)) {
            points.set(`${mirroredPoint.x},${mirroredPoint.y}`, mirroredPoint);
          }
        }
      }
    }

    return [...points.values()];
  }, [getMirroredPoints, isInside]);

  const setPixel = useCallback((source: CanvasState, point: PixelPoint, color: Pixel): CanvasState => {
      if (!isInside(point.x, point.y)) {
        return source;
      }

      const resolved = resolveCelHelper(source, activeFrameId, activeLayerId);
      if (!resolved) {
        return source;
      }

      const { frameId: targetFrameId, cel: targetCel } = resolved;
      const matrixIndex = source.matrices.findIndex((m) => m.frames.some((f) => f.id === targetFrameId));
      if (matrixIndex === -1) {
        return source;
      }
      const targetMatrix = source.matrices[matrixIndex];
      const frameIndex = targetMatrix.frames.findIndex((f) => f.id === targetFrameId);
      if (frameIndex === -1) {
        return source;
      }

      const targetFrame = targetMatrix.frames[frameIndex];
      const targetCelIndex = targetFrame.cels.findIndex((cel) => cel.layerId === activeLayerId);
      if (targetCelIndex === -1) {
        return source;
      }

      const index = toIndex(point.x, point.y);

      if (targetCel.pixels[index] === color) {
        return source;
      }

      const nextFrames = targetMatrix.frames.slice();
      const nextCels = targetFrame.cels.slice();
      const nextPixels = targetCel.pixels.slice();
      nextPixels[index] = color;
      nextCels[targetCelIndex] = {
        ...targetCel,
        pixels: nextPixels,
      };
      nextFrames[frameIndex] = {
        ...targetFrame,
        cels: nextCels,
      };

      const nextMatrices = source.matrices.slice();
      nextMatrices[matrixIndex] = {
        ...targetMatrix,
        frames: nextFrames,
      };

      return {
        ...source,
        matrices: nextMatrices,
      };
  }, [isInside, toIndex, activeFrameId, activeLayerId]);

  const setBrushSize = useCallback((nextSize: number) => {
    setBrushSizeState(clamp(Math.round(nextSize), 1, 8));
  }, []);

  const setOpacity = useCallback((nextOpacity: number) => {
    setOpacityState(clamp(Math.round(nextOpacity), 10, 100));
  }, []);

  const applyBrush = useCallback(
    (source: CanvasState, center: PixelPoint, color: Pixel): CanvasState => {
      const radiusStart = -Math.floor((brushSize - 1) / 2);
      const points = new Map<string, PixelPoint>();

      for (let offsetY = 0; offsetY < brushSize; offsetY += 1) {
        for (let offsetX = 0; offsetX < brushSize; offsetX += 1) {
          const point = {
            x: center.x + radiusStart + offsetX,
            y: center.y + radiusStart + offsetY,
          };

          for (const mirroredPoint of getMirroredPoints(point, mirrorX, mirrorY)) {
            if (isInside(mirroredPoint.x, mirroredPoint.y)) {
              points.set(`${mirroredPoint.x},${mirroredPoint.y}`, mirroredPoint);
            }
          }
        }
      }

      let next = source;

      for (const point of points.values()) {
        next = setPixel(next, point, color);
      }

      return next;
    },
    [brushSize, mirrorX, mirrorY, getMirroredPoints, isInside, setPixel],
  );

  const getPixel = useCallback((source: CanvasState, point: PixelPoint): Pixel => {
    if (!isInside(point.x, point.y)) {
      return null;
    }

    const resolved = resolveCelHelper(source, activeFrameId, activeLayerId);
    if (!resolved) {
      return null;
    }

    return resolved.cel.pixels[toIndex(point.x, point.y)] ?? null;
  }, [activeFrameId, activeLayerId, isInside, toIndex]);

  const applyToneBrush = useCallback(
    (source: CanvasState, center: PixelPoint, direction: "lighten" | "darken"): CanvasState => {
      const radiusStart = -Math.floor((brushSize - 1) / 2);
      const points = new Map<string, PixelPoint>();

      for (let offsetY = 0; offsetY < brushSize; offsetY += 1) {
        for (let offsetX = 0; offsetX < brushSize; offsetX += 1) {
          const point = {
            x: center.x + radiusStart + offsetX,
            y: center.y + radiusStart + offsetY,
          };

          for (const mirroredPoint of getMirroredPoints(point, mirrorX, mirrorY)) {
            if (isInside(mirroredPoint.x, mirroredPoint.y)) {
              points.set(`${mirroredPoint.x},${mirroredPoint.y}`, mirroredPoint);
            }
          }
        }
      }

      let next = source;
      const baseState = toneBaseStateRef.current ?? source;

      for (const point of points.values()) {
        const pointIndex = toIndex(point.x, point.y);

        if (toneTouchedPixelsRef.current.has(pointIndex)) {
          continue;
        }

        const currentColor = getPixel(baseState, point);
        const adjustedColor = getToneAdjustedColor(currentColor, direction);

        if (adjustedColor) {
          next = setPixel(next, point, adjustedColor);
          toneTouchedPixelsRef.current.add(pointIndex);
        }
      }

      return next;
    },
    [brushSize, getMirroredPoints, getPixel, isInside, mirrorX, mirrorY, setPixel, toIndex],
  );

  const drawLine = useCallback(
    (source: CanvasState, start: PixelPoint, end: PixelPoint, color: Pixel): CanvasState => {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
      let next = source;

      for (let step = 0; step <= steps; step += 1) {
        next = applyBrush(next, {
          x: Math.round(start.x + (dx * step) / steps),
          y: Math.round(start.y + (dy * step) / steps),
        }, color);
      }

      return next;
    },
    [applyBrush],
  );

  const drawToneLine = useCallback(
    (source: CanvasState, start: PixelPoint, end: PixelPoint, direction: "lighten" | "darken"): CanvasState => {
      let next = source;

      for (const point of getLinePoints(start, end)) {
        next = applyToneBrush(next, point, direction);
      }

      return next;
    },
    [applyToneBrush],
  );

  const drawRectangle = useCallback(
    (source: CanvasState, start: PixelPoint, end: PixelPoint, color: Pixel): CanvasState => {
      const left = Math.min(start.x, end.x);
      const right = Math.max(start.x, end.x);
      const top = Math.min(start.y, end.y);
      const bottom = Math.max(start.y, end.y);
      let next = source;

      for (let x = left; x <= right; x += 1) {
        next = applyBrush(next, { x, y: top }, color);
        if (bottom !== top) {
          next = applyBrush(next, { x, y: bottom }, color);
        }
      }

      for (let y = top + 1; y < bottom; y += 1) {
        next = applyBrush(next, { x: left, y }, color);
        if (right !== left) {
          next = applyBrush(next, { x: right, y }, color);
        }
      }

      return next;
    },
    [applyBrush],
  );

  const drawEllipse = useCallback(
    (source: CanvasState, start: PixelPoint, end: PixelPoint, color: Pixel): CanvasState => {
      let next = source;
      const points = getEllipsePoints(start, end);

      for (const point of points) {
        next = applyBrush(next, point, color);
      }

      return next;
    },
    [applyBrush],
  );

  const drawShape = useCallback(
    (source: CanvasState, start: PixelPoint, end: PixelPoint, color: Pixel): CanvasState => {
      if (activeTool === "line") {
        return drawLine(source, start, end, color);
      }

      if (activeTool === "rectangle") {
        return drawRectangle(source, start, end, color);
      }

      if (activeTool === "ellipse") {
        return drawEllipse(source, start, end, color);
      }

      return source;
    },
    [activeTool, drawEllipse, drawLine, drawRectangle],
  );

  const floodFill = useCallback((source: CanvasState, start: PixelPoint, color: Pixel): CanvasState => {
    if (!isInside(start.x, start.y)) {
      return source;
    }

    const resolved = resolveCelHelper(source, activeFrameId, activeLayerId);
    if (!resolved) {
      return source;
    }

    const { frameId: targetFrameId, cel: targetCel } = resolved;
    const matrixIndex = source.matrices.findIndex((m) => m.frames.some((f) => f.id === targetFrameId));
    if (matrixIndex === -1) {
      return source;
    }
    const targetMatrix = source.matrices[matrixIndex];
    const frameIndex = targetMatrix.frames.findIndex((f) => f.id === targetFrameId);
    if (frameIndex === -1) {
      return source;
    }

    const targetFrame = targetMatrix.frames[frameIndex];
    const targetCelIndex = targetFrame.cels.findIndex((cel) => cel.layerId === activeLayerId);
    if (targetCelIndex === -1) {
      return source;
    }

    const target = targetCel.pixels[toIndex(start.x, start.y)];

    if (target === color) {
      return source;
    }

    const nextFrames = targetMatrix.frames.slice();
    const nextCels = targetFrame.cels.slice();
    const nextPixels = targetCel.pixels.slice();
    const queue = [start];
    const visited = new Set<number>();

    while (queue.length > 0) {
      const point = queue.shift()!;

      if (!isInside(point.x, point.y)) {
        continue;
      }

      const index = toIndex(point.x, point.y);

      if (visited.has(index) || nextPixels[index] !== target) {
        continue;
      }

      visited.add(index);
      nextPixels[index] = color;
      queue.push(
        { x: point.x + 1, y: point.y },
        { x: point.x - 1, y: point.y },
        { x: point.x, y: point.y + 1 },
        { x: point.x, y: point.y - 1 },
      );
    }

    nextCels[targetCelIndex] = {
      ...targetCel,
      pixels: nextPixels,
    };
    nextFrames[frameIndex] = {
      ...targetFrame,
      cels: nextCels,
    };

    const nextMatrices = source.matrices.slice();
    nextMatrices[matrixIndex] = {
      ...targetMatrix,
      frames: nextFrames,
    };

    return {
      ...source,
      matrices: nextMatrices,
    };
  }, [isInside, toIndex, activeFrameId, activeLayerId]);

  const moveSelectionPixels = useCallback(
    (source: CanvasState, rect: SelectionRect, offsetX: number, offsetY: number): CanvasState => {
      const resolved = resolveCelHelper(source, activeFrameId, activeLayerId);
      if (!resolved) {
        return source;
      }

      const { frameId: targetFrameId, cel: targetCel } = resolved;
      const matrixIndex = source.matrices.findIndex((matrix) => matrix.frames.some((frame) => frame.id === targetFrameId));
      if (matrixIndex === -1) {
        return source;
      }

      const targetMatrix = source.matrices[matrixIndex];
      const frameIndex = targetMatrix.frames.findIndex((frame) => frame.id === targetFrameId);
      if (frameIndex === -1) {
        return source;
      }

      const targetFrame = targetMatrix.frames[frameIndex];
      const targetCelIndex = targetFrame.cels.findIndex((cel) => cel.layerId === activeLayerId);
      if (targetCelIndex === -1) {
        return source;
      }

      const nextPixels = targetCel.pixels.slice();
      const selectedPixels: Array<{ color: Pixel; x: number; y: number }> = [];

      for (let y = rect.y; y < rect.y + rect.height; y += 1) {
        for (let x = rect.x; x < rect.x + rect.width; x += 1) {
          if (!isInside(x, y)) {
            continue;
          }

          const index = toIndex(x, y);
          selectedPixels.push({ color: targetCel.pixels[index] ?? null, x, y });
          nextPixels[index] = null;
        }
      }

      for (const pixel of selectedPixels) {
        const x = pixel.x + offsetX;
        const y = pixel.y + offsetY;

        if (!isInside(x, y)) {
          continue;
        }

        nextPixels[toIndex(x, y)] = pixel.color;
      }

      const nextFrames = targetMatrix.frames.slice();
      const nextCels = targetFrame.cels.slice();
      nextCels[targetCelIndex] = {
        ...targetCel,
        pixels: nextPixels,
      };
      nextFrames[frameIndex] = {
        ...targetFrame,
        cels: nextCels,
      };

      const nextMatrices = source.matrices.slice();
      nextMatrices[matrixIndex] = {
        ...targetMatrix,
        frames: nextFrames,
      };

      return {
        ...source,
        matrices: nextMatrices,
      };
    },
    [activeFrameId, activeLayerId, isInside, toIndex],
  );

  const updateActiveCelPixels = useCallback(
    (producer: (pixels: Pixel[]) => Pixel[]) => {
      const resolved = resolveCelHelper(history.present, activeFrameId, activeLayerId);
      if (!resolved) {
        return;
      }

      const { frameId: targetFrameId, cel: targetCel } = resolved;
      const matrixIndex = history.present.matrices.findIndex((matrix) => matrix.frames.some((frame) => frame.id === targetFrameId));
      if (matrixIndex === -1) {
        return;
      }

      const targetMatrix = history.present.matrices[matrixIndex];
      const frameIndex = targetMatrix.frames.findIndex((frame) => frame.id === targetFrameId);
      if (frameIndex === -1) {
        return;
      }

      const targetFrame = targetMatrix.frames[frameIndex];
      const targetCelIndex = targetFrame.cels.findIndex((cel) => cel.layerId === activeLayerId);
      if (targetCelIndex === -1) {
        return;
      }

      const nextFrames = targetMatrix.frames.slice();
      const nextCels = targetFrame.cels.slice();
      nextCels[targetCelIndex] = {
        ...targetCel,
        pixels: producer(targetCel.pixels.slice()),
      };
      nextFrames[frameIndex] = {
        ...targetFrame,
        cels: nextCels,
      };

      const nextMatrices = history.present.matrices.slice();
      nextMatrices[matrixIndex] = {
        ...targetMatrix,
        frames: nextFrames,
      };

      history.commit({
        ...history.present,
        matrices: nextMatrices,
      });
    },
    [activeFrameId, activeLayerId, history],
  );

  const copySelection = useCallback(() => {
    if (!selectionRect) {
      return;
    }

    const resolved = resolveCelHelper(history.present, activeFrameId, activeLayerId);
    if (!resolved) {
      return;
    }

    const pixels: Pixel[] = [];
    for (let y = selectionRect.y; y < selectionRect.y + selectionRect.height; y += 1) {
      for (let x = selectionRect.x; x < selectionRect.x + selectionRect.width; x += 1) {
        pixels.push(isInside(x, y) ? resolved.cel.pixels[toIndex(x, y)] ?? null : null);
      }
    }

    setCopiedSelectionData({
      pixels,
      rect: selectionRect,
    });
    setShowCopiedSelectionStamp(true);
  }, [activeFrameId, activeLayerId, history.present, isInside, selectionRect, toIndex]);

  const deleteSelection = useCallback(() => {
    if (!selectionRect) {
      return;
    }

    updateActiveCelPixels((pixels) => {
      for (let y = selectionRect.y; y < selectionRect.y + selectionRect.height; y += 1) {
        for (let x = selectionRect.x; x < selectionRect.x + selectionRect.width; x += 1) {
          if (isInside(x, y)) {
            pixels[toIndex(x, y)] = null;
          }
        }
      }

      return pixels;
    });
  }, [isInside, selectionRect, toIndex, updateActiveCelPixels]);

  const cutSelection = useCallback(() => {
    copySelection();
    deleteSelection();
  }, [copySelection, deleteSelection]);

  const pasteSelection = useCallback(() => {
    if (!copiedSelectionData) {
      return;
    }

    const targetRect = clampSelectionRect(
      selectionRect
        ? { ...selectionRect, width: copiedSelectionData.rect.width, height: copiedSelectionData.rect.height }
        : copiedSelectionData.rect,
      width,
      height,
    );

    updateActiveCelPixels((pixels) => {
      for (let y = 0; y < copiedSelectionData.rect.height; y += 1) {
        for (let x = 0; x < copiedSelectionData.rect.width; x += 1) {
          const targetX = targetRect.x + x;
          const targetY = targetRect.y + y;

          if (isInside(targetX, targetY)) {
            pixels[toIndex(targetX, targetY)] = copiedSelectionData.pixels[y * copiedSelectionData.rect.width + x] ?? null;
          }
        }
      }

      return pixels;
    });
    setSelectionRect(targetRect);
  }, [copiedSelectionData, height, isInside, selectionRect, toIndex, updateActiveCelPixels, width]);

  const flipSelection = useCallback(
    (axis: "horizontal" | "vertical") => {
      if (!selectionRect) {
        return;
      }

      updateActiveCelPixels((pixels) => {
        const selectedPixels: Pixel[] = [];

        for (let y = 0; y < selectionRect.height; y += 1) {
          for (let x = 0; x < selectionRect.width; x += 1) {
            const sourceX = selectionRect.x + x;
            const sourceY = selectionRect.y + y;
            selectedPixels.push(isInside(sourceX, sourceY) ? pixels[toIndex(sourceX, sourceY)] ?? null : null);
          }
        }

        for (let y = 0; y < selectionRect.height; y += 1) {
          for (let x = 0; x < selectionRect.width; x += 1) {
            const sourceX = axis === "horizontal" ? selectionRect.width - 1 - x : x;
            const sourceY = axis === "vertical" ? selectionRect.height - 1 - y : y;
            const targetX = selectionRect.x + x;
            const targetY = selectionRect.y + y;

            if (isInside(targetX, targetY)) {
              pixels[toIndex(targetX, targetY)] = selectedPixels[sourceY * selectionRect.width + sourceX] ?? null;
            }
          }
        }

        return pixels;
      });
    },
    [isInside, selectionRect, toIndex, updateActiveCelPixels],
  );

  const drawAt = useCallback(
    (point: PixelPoint, fromPoint: PixelPoint | null) => {
      const source = workingStateRef.current;
      const next =
        activeTool === "lighten" || activeTool === "darken"
          ? fromPoint
            ? drawToneLine(source, fromPoint, point, activeTool)
            : applyToneBrush(source, point, activeTool)
          : fromPoint
          ? drawLine(source, fromPoint, point, strokeColorRef.current)
          : applyBrush(source, point, strokeColorRef.current);

      if (next === source) {
        return;
      }

      workingStateRef.current = next;
      history.replace(next);
    },
    [activeTool, applyBrush, applyToneBrush, drawLine, drawToneLine, history],
  );

  const combinedPixels = useMemo(() => {
    const combined = Array.from<Pixel>({ length: width * height }).fill(null);
    const activeMatrix = history.present.matrices.find((m) => m.id === activeMatrixId) || history.present.matrices[0];
    if (!activeMatrix) return combined;

    const currentFrame = activeMatrix.frames.find((f) => f.id === activeFrameId) || activeMatrix.frames[0];
    if (!currentFrame) return combined;

    activeMatrix.layers.forEach((layer) => {
      if (!layer.visible) {
        return;
      }
      const resolved = resolveCelHelper(history.present, currentFrame.id, layer.id);
      if (resolved) {
        resolved.cel.pixels.forEach((color, index) => {
          if (color) {
            combined[index] = color;
          }
        });
      }
    });
    return combined;
  }, [history.present, activeMatrixId, activeFrameId, width, height]);

  const pickColor = useCallback(
    (point: PixelPoint, useBackground = false) => {
      const color = combinedPixels[toIndex(point.x, point.y)];

      if (!color) {
        return;
      }

      if (useBackground) {
        setBackground(color);
      } else {
        setForeground(color);
      }
    },
    [combinedPixels, toIndex],
  );

  const bucketAt = useCallback(
    (point: PixelPoint, useBackground = false) => {
      const next = floodFill(history.present, point, useBackground ? null : getPaintColor(foreground, opacity));

      if (next !== history.present) {
        history.commit(next);
      }
    },
    [floodFill, foreground, history, opacity],
  );

  const getPointFromEvent = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.floor(((event.clientX - rect.left) / rect.width) * width);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * height);

    if (!isInside(x, y)) {
      return null;
    }

    return { x, y };
  }, [width, height, isInside]);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (event.button !== 0 && event.button !== 2) {
        return;
      }

      const point = getPointFromEvent(event);

      if (!point) {
        return;
      }

      event.currentTarget.setPointerCapture(event.pointerId);
      setCursorPoint(point);

      if (activeTool === "selection") {
        isDrawingRef.current = true;
        selectionStartRef.current = point;

        if (selectionRect && isPointInSelection(point, selectionRect)) {
          const shouldMoveContents = event.shiftKey || selectionMoveContentsMode;
          isMovingSelectionRef.current = true;
          selectionMoveContentsRef.current = shouldMoveContents;
          selectionMoveBaseStateRef.current = history.present;
          selectionMoveBaseRectRef.current = selectionRect;
          selectionMoveStartRef.current = point;
          workingStateRef.current = history.present;
          if (shouldMoveContents) {
            history.commit(history.present);
          }
          return;
        }

        isMovingSelectionRef.current = false;
        setShowCopiedSelectionStamp(false);
        setSelectionRect(createSelectionRect(point, point, width, height));
        return;
      }

      if (activeTool === "eyedropper") {
        pickColor(point, event.button === 2);
        return;
      }

      if (activeTool === "bucket") {
        bucketAt(point, event.button === 2);
        return;
      }

      isDrawingRef.current = true;
      lastPointRef.current = point;
      shapeStartRef.current = point;
      workingStateRef.current = history.present;
      shapeBaseStateRef.current = history.present;
      toneBaseStateRef.current = history.present;
      toneTouchedPixelsRef.current.clear();
      strokeColorRef.current =
        activeTool === "eraser" || event.button === 2 ? null : getPaintColor(foreground, opacity);
      history.commit(history.present);

      if (isShapeTool(activeTool)) {
        const next = drawShape(history.present, point, point, strokeColorRef.current);
        workingStateRef.current = next;
        history.replace(next);
        return;
      }

      drawAt(point, null);
    },
    [activeTool, bucketAt, drawAt, drawShape, foreground, getPointFromEvent, height, history, opacity, pickColor, selectionMoveContentsMode, selectionRect, width],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const point = getPointFromEvent(event);
      setCursorPoint(point);

      if (!point || !isDrawingRef.current) {
        return;
      }

      if (activeTool === "selection") {
        if (isMovingSelectionRef.current) {
          const baseState = selectionMoveBaseStateRef.current;
          const baseRect = selectionMoveBaseRectRef.current;
          const start = selectionMoveStartRef.current;

          if (baseState && baseRect && start) {
            const offsetX = point.x - start.x;
            const offsetY = point.y - start.y;
            const nextRect = clampSelectionRect({
              ...baseRect,
              x: baseRect.x + offsetX,
              y: baseRect.y + offsetY,
            }, width, height);
            const actualOffsetX = nextRect.x - baseRect.x;
            const actualOffsetY = nextRect.y - baseRect.y;
            setSelectionRect(nextRect);
            if (selectionMoveContentsRef.current) {
              const next = moveSelectionPixels(baseState, baseRect, actualOffsetX, actualOffsetY);
              workingStateRef.current = next;
              history.replace(next);
            }
          }
          return;
        }

        const start = selectionStartRef.current;
        if (start) {
          const nextRect = createSelectionRect(start, point, width, height);
          setSelectionRect(nextRect);
        }
        return;
      }

      if (isShapeTool(activeTool)) {
        const start = shapeStartRef.current;
        const baseState = shapeBaseStateRef.current;
        if (start && baseState) {
          const next = drawShape(baseState, start, point, strokeColorRef.current);
          workingStateRef.current = next;
          history.replace(next);
        }
        return;
      }

      drawAt(point, lastPointRef.current);
      lastPointRef.current = point;
    },
    [activeTool, drawAt, drawShape, getPointFromEvent, history, moveSelectionPixels, width, height],
  );

  const stopDrawing = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (isDrawingRef.current && activeTool === "selection") {
      if (isMovingSelectionRef.current) {
        const point = getPointFromEvent(event);
        const baseState = selectionMoveBaseStateRef.current;
        const baseRect = selectionMoveBaseRectRef.current;
        const start = selectionMoveStartRef.current;

        if (point && baseState && baseRect && start) {
          const offsetX = point.x - start.x;
          const offsetY = point.y - start.y;
          const nextRect = clampSelectionRect({
            ...baseRect,
            x: baseRect.x + offsetX,
            y: baseRect.y + offsetY,
          }, width, height);
          const actualOffsetX = nextRect.x - baseRect.x;
          const actualOffsetY = nextRect.y - baseRect.y;
          setSelectionRect(nextRect);
          if (selectionMoveContentsRef.current) {
            const next = moveSelectionPixels(baseState, baseRect, actualOffsetX, actualOffsetY);
            workingStateRef.current = next;
            history.replace(next);
          }
        }
      }

      isMovingSelectionRef.current = false;
      selectionMoveContentsRef.current = false;
      selectionStartRef.current = null;
      selectionMoveBaseStateRef.current = null;
      selectionMoveBaseRectRef.current = null;
      selectionMoveStartRef.current = null;
    }

    if (isDrawingRef.current && isShapeTool(activeTool)) {
      const start = shapeStartRef.current;
      const end = getPointFromEvent(event);
      const baseState = shapeBaseStateRef.current;

      if (start && end && baseState) {
        const next = drawShape(baseState, start, end, strokeColorRef.current);
        if (next !== workingStateRef.current) {
          workingStateRef.current = next;
          history.replace(next);
        }
      }
    }

    isDrawingRef.current = false;
    lastPointRef.current = null;
    shapeStartRef.current = null;
    shapeBaseStateRef.current = null;
    toneBaseStateRef.current = null;
    toneTouchedPixelsRef.current.clear();
  }, [activeTool, drawShape, getPointFromEvent, history, moveSelectionPixels, width, height]);

  const resizeCanvas = useCallback((newWidth: number, newHeight: number) => {
    const nextWidth = clamp(Math.round(newWidth), 4, 128);
    const nextHeight = clamp(Math.round(newHeight), 4, 128);
    setWidth(nextWidth);
    setHeight(nextHeight);

    const nextState = createDefaultState(nextWidth, nextHeight);
    workingStateRef.current = nextState;
    const firstMatrix = nextState.matrices[0];
    setActiveMatrixIdState(firstMatrix.id);
    setActiveFrameId(firstMatrix.frames[0].id);
    setActiveLayerId(firstMatrix.layers[0].id);
    history.reset(nextState);
  }, [history]);

  const clearCanvas = useCallback(() => {
    const nextState = createDefaultState(width, height);
    workingStateRef.current = nextState;
    const firstMatrix = nextState.matrices[0];
    setActiveMatrixIdState(firstMatrix.id);
    setActiveFrameId(firstMatrix.frames[0].id);
    setActiveLayerId(firstMatrix.layers[0].id);
    history.commit(nextState); // Allow undo/redo history to preserve the action
  }, [width, height, history]);

  const importCanvas = useCallback((pixels: Pixel[], newWidth: number, newHeight: number) => {
    const nextWidth = clamp(Math.round(newWidth), 4, 128);
    const nextHeight = clamp(Math.round(newHeight), 4, 128);
    setWidth(nextWidth);
    setHeight(nextHeight);

    const importedLayers: Layer[] = [
      {
        id: `layer-${Date.now()}`,
        name: "Layer 1",
        visible: true,
      },
    ];

    const importedFrames: Frame[] = [
      {
        id: `frame-${Date.now()}`,
        cels: [
          {
            layerId: importedLayers[0].id,
            pixels: pixels,
          },
        ],
      },
    ];

    const nextState: CanvasState = {
      matrices: [
        {
          id: "imported-matrix",
          name: "Imported",
          layers: importedLayers,
          frames: importedFrames,
          tags: [],
        }
      ],
      activeMatrixId: "imported-matrix",
    };

    workingStateRef.current = nextState;
    setActiveMatrixIdState("imported-matrix");
    setActiveFrameId(importedFrames[0].id);
    setActiveLayerId(importedLayers[0].id);
    history.reset(nextState);
  }, [history]);

  // Frame CRUD operations
/**
 * Adds a new frame.
 * If `copyLayerId` is provided, the specified layer's pixel data from the previous frame
 * is copied into the new frame. Other layers start empty.
 */
const addFrame = useCallback((copyLayerId?: string) => {
  const nextId = `frame-${Date.now()}`;
  const activeMatrix = history.present.matrices.find((m) => m.id === activeMatrixId);
  if (!activeMatrix) return;

  const activeIndex = activeMatrix.frames.findIndex((f) => f.id === activeFrameId);
  const prevFrame = activeIndex > 0 ? activeMatrix.frames[activeIndex - 1] : null;

  const newCels = activeMatrix.layers.map((layer) => {
    if (copyLayerId && prevFrame && layer.id === copyLayerId) {
      const prevCel = prevFrame.cels.find((c) => c.layerId === layer.id);
      return {
        layerId: layer.id,
        pixels: prevCel ? prevCel.pixels.slice() : Array.from<Pixel>({ length: width * height }).fill(null),
      };
    }
    return {
      layerId: layer.id,
      pixels: Array.from<Pixel>({ length: width * height }).fill(null),
    };
  });

  const newFrame: Frame = {
    id: nextId,
    cels: newCels,
  };

  const nextFrames = activeMatrix.frames.slice();
  if (activeIndex !== -1) {
    nextFrames.splice(activeIndex + 1, 0, newFrame);
  } else {
    nextFrames.push(newFrame);
  }

  const nextMatrices = history.present.matrices.map((m) => {
    if (m.id === activeMatrixId) {
      return { ...m, frames: nextFrames };
    }
    return m;
  });

  const nextState = {
    ...history.present,
    matrices: nextMatrices,
  };

  history.commit(nextState);
  setActiveFrameId(nextId);
}, [width, height, history, activeMatrixId, activeFrameId]);

  const duplicateFrame = useCallback(() => {
    const activeMatrix = history.present.matrices.find((m) => m.id === activeMatrixId);
    if (!activeMatrix) return;

    const currentFrame = activeMatrix.frames.find((f) => f.id === activeFrameId) || activeMatrix.frames[0];
    if (!currentFrame) return;

    const nextId = `frame-${Date.now()}`;
    const newCels = currentFrame.cels.map((cel) => ({
      layerId: cel.layerId,
      pixels: cel.pixels.slice(),
    }));
    const newFrame: Frame = {
      id: nextId,
      cels: newCels,
    };

    const activeIndex = activeMatrix.frames.findIndex((f) => f.id === activeFrameId);
    const nextFrames = activeMatrix.frames.slice();
    if (activeIndex !== -1) {
      nextFrames.splice(activeIndex + 1, 0, newFrame);
    } else {
      nextFrames.push(newFrame);
    }

    const nextMatrices = history.present.matrices.map((m) => {
      if (m.id === activeMatrixId) {
        return { ...m, frames: nextFrames };
      }
      return m;
    });

    const nextState = {
      ...history.present,
      matrices: nextMatrices,
    };

    history.commit(nextState);
    setActiveFrameId(nextId);
  }, [history, activeMatrixId, activeFrameId]);

  const copyFrame = useCallback((frameId: string) => {
    const activeMatrix = history.present.matrices.find((m) => m.id === activeMatrixId);
    if (!activeMatrix) return;

    const frame = activeMatrix.frames.find((f) => f.id === frameId);
    if (!frame) return;

    const celsCopy = frame.cels.map((cel) => ({
      layerId: cel.layerId,
      pixels: cel.pixels.slice(),
    }));

    setCopiedFrameData({ cels: celsCopy });
  }, [history, activeMatrixId]);

  const pasteFrame = useCallback(() => {
    if (!copiedFrameData || !activeMatrix) return;

    const activeIndex = activeMatrix.frames.findIndex((f) => f.id === activeFrameId);
    const nextId = `frame-${Date.now()}`;

    const newCels = activeMatrix.layers.map((layer, idx) => {
      const copiedCel = copiedFrameData.cels[idx] || copiedFrameData.cels.find((c) => c.layerId === layer.id);
      return {
        layerId: layer.id,
        pixels: copiedCel ? copiedCel.pixels.slice() : Array.from<Pixel>({ length: width * height }).fill(null),
      };
    });

    const newFrame: Frame = {
      id: nextId,
      cels: newCels,
    };

    const nextFrames = activeMatrix.frames.slice();
    if (activeIndex !== -1) {
      nextFrames.splice(activeIndex + 1, 0, newFrame);
    } else {
      nextFrames.push(newFrame);
    }

    const nextMatrices = history.present.matrices.map((m) =>
      m.id === activeMatrixId ? { ...m, frames: nextFrames } : m
    );

    const nextState = {
      ...history.present,
      matrices: nextMatrices,
    };

    history.commit(nextState);
    setActiveFrameId(nextId);
  }, [width, height, history, activeMatrixId, activeMatrix, activeFrameId, copiedFrameData]);

  const deleteFrame = useCallback((id: string) => {
    const activeMatrix = history.present.matrices.find((m) => m.id === activeMatrixId);
    if (!activeMatrix || activeMatrix.frames.length <= 1) {
      return;
    }
    const nextFrames = activeMatrix.frames.filter((f) => f.id !== id);
    const activeIndex = activeMatrix.frames.findIndex((f) => f.id === id);

    const nextMatrices = history.present.matrices.map((m) => {
      if (m.id === activeMatrixId) {
        return { ...m, frames: nextFrames };
      }
      return m;
    });

    const nextState = {
      ...history.present,
      matrices: nextMatrices,
    };

    history.commit(nextState);

    if (activeFrameId === id) {
      const fallbackIndex = Math.max(0, activeIndex - 1);
      setActiveFrameId(nextFrames[fallbackIndex].id);
    }
  }, [activeFrameId, activeMatrixId, history]);

  const reorderFrame = useCallback((id: string, direction: "left" | "right") => {
    const activeMatrix = history.present.matrices.find((m) => m.id === activeMatrixId);
    if (!activeMatrix) return;

    const index = activeMatrix.frames.findIndex((f) => f.id === id);
    if (index === -1) {
      return;
    }

    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= activeMatrix.frames.length) {
      return;
    }

    const nextFrames = activeMatrix.frames.slice();
    const temp = nextFrames[index];
    nextFrames[index] = nextFrames[targetIndex];
    nextFrames[targetIndex] = temp;

    const nextMatrices = history.present.matrices.map((m) => {
      if (m.id === activeMatrixId) {
        return { ...m, frames: nextFrames };
      }
      return m;
    });

    const nextState = {
      ...history.present,
      matrices: nextMatrices,
    };

    history.commit(nextState);
    setActiveFrameId(id);
  }, [history, activeMatrixId]);

  const reorderFrameTo = useCallback((fromIndex: number, toIndex: number) => {
    const activeMatrix = history.present.matrices.find((m) => m.id === activeMatrixId);
    if (!activeMatrix) return;
    if (fromIndex < 0 || fromIndex >= activeMatrix.frames.length || toIndex < 0 || toIndex >= activeMatrix.frames.length) return;

    const nextFrames = activeMatrix.frames.slice();
    const [moved] = nextFrames.splice(fromIndex, 1);
    nextFrames.splice(toIndex, 0, moved);

    const nextMatrices = history.present.matrices.map((m) => {
      if (m.id === activeMatrixId) {
        return { ...m, frames: nextFrames };
      }
      return m;
    });

    const nextState = {
      ...history.present,
      matrices: nextMatrices,
    };

    history.commit(nextState);
    setActiveFrameId(moved.id);
  }, [history, activeMatrixId]);

  // Onion skin source data getter
  const onionSkinPixels = useMemo(() => {
    const activeMatrix = history.present.matrices.find((m) => m.id === activeMatrixId);
    if (!activeMatrix) return null;

    const activeIndex = activeMatrix.frames.findIndex((f) => f.id === activeFrameId);
    if (activeIndex <= 0) {
      return null;
    }

    const prevFrame = activeMatrix.frames[activeIndex - 1];
    const combined = Array.from<Pixel>({ length: width * height }).fill(null);
    activeMatrix.layers.forEach((layer, idx) => {
      if (!layer.visible) return;
      const resolved = resolveCelHelper(history.present, prevFrame.id, layer.id);
      if (!resolved) return;

      // Skip the bottom-most layer in onion skin ONLY if there are other layers
      // and it acts as a solid background layer (i.e. has no transparent/null pixels).
      if (idx === 0 && activeMatrix.layers.length > 1) {
        if (!resolved.cel.pixels.includes(null)) {
          return; // Skip background layer
        }
      }

      resolved.cel.pixels.forEach((color, index) => {
        if (color) {
          combined[index] = color;
        }
      });
    });
    return combined;
  }, [history.present, activeMatrixId, activeFrameId, width, height]);

  // Active frame layers getters
  const activeFrameLayers = useMemo(() => {
    return activeMatrixLayers;
  }, [activeMatrixLayers]);

  // Layer CRUD operations inside current frame
  const addLayer = useCallback(() => {
    if (!activeMatrix) return;
    const nextId = `layer-${Date.now()}`;
    const nextName = `Layer ${activeMatrix.layers.length + 1}`;
    const newLayer: Layer = {
      id: nextId,
      name: nextName,
      visible: true,
    };

    const nextLayers = [...activeMatrix.layers, newLayer];
    const nextFrames = activeMatrix.frames.map((frame) => {
      const newCel: Cel = {
        layerId: nextId,
        pixels: Array.from<Pixel>({ length: width * height }).fill(null),
      };
      return {
        ...frame,
        cels: [...frame.cels, newCel],
      };
    });

    const updatedMatrix = {
      ...activeMatrix,
      layers: nextLayers,
      frames: nextFrames,
    };

    const nextMatrices = history.present.matrices.map((m) =>
      m.id === activeMatrixId ? updatedMatrix : m
    );

    const nextState = {
      ...history.present,
      matrices: nextMatrices,
    };

    history.commit(nextState);
    setActiveLayerId(nextId);
  }, [width, height, history, activeMatrixId, activeMatrix]);

  const deleteLayer = useCallback((id: string) => {
    if (!activeMatrix || activeMatrix.layers.length <= 1) {
      return;
    }

    const nextLayers = activeMatrix.layers.filter((layer) => layer.id !== id);
    const nextFrames = activeMatrix.frames.map((frame) => {
      return {
        ...frame,
        cels: frame.cels.filter((cel) => cel.layerId !== id),
      };
    });

    const updatedMatrix = {
      ...activeMatrix,
      layers: nextLayers,
      frames: nextFrames,
    };

    const nextMatrices = history.present.matrices.map((m) =>
      m.id === activeMatrixId ? updatedMatrix : m
    );

    const nextState = {
      ...history.present,
      matrices: nextMatrices,
    };

    history.commit(nextState);

    if (activeLayerId === id) {
      setActiveLayerId(nextLayers[nextLayers.length - 1].id);
    }
  }, [activeLayerId, history, activeMatrixId, activeMatrix]);

  const toggleLayerVisibility = useCallback((id: string) => {
    if (!activeMatrix) return;
    const nextLayers = activeMatrix.layers.map((layer) =>
      layer.id === id ? { ...layer, visible: !layer.visible } : layer
    );
    const nextMatrices = history.present.matrices.map((m) =>
      m.id === activeMatrixId ? { ...m, layers: nextLayers } : m
    );
    const nextState = {
      ...history.present,
      matrices: nextMatrices,
    };
    history.commit(nextState);
  }, [history, activeMatrixId, activeMatrix]);

  const reorderLayer = useCallback((id: string, direction: "up" | "down") => {
    if (!activeMatrix) return;
    const index = activeMatrix.layers.findIndex((layer) => layer.id === id);
    if (index === -1) {
      return;
    }
    const targetIndex = direction === "up" ? index + 1 : index - 1;
    if (targetIndex < 0 || targetIndex >= activeMatrix.layers.length) {
      return;
    }

    const nextLayers = activeMatrix.layers.slice();
    const temp = nextLayers[index];
    nextLayers[index] = nextLayers[targetIndex];
    nextLayers[targetIndex] = temp;

    const nextMatrices = history.present.matrices.map((m) =>
      m.id === activeMatrixId ? { ...m, layers: nextLayers } : m
    );

    const nextState = {
      ...history.present,
      matrices: nextMatrices,
    };

    history.commit(nextState);
  }, [history, activeMatrixId, activeMatrix]);

  const reorderLayerTo = useCallback((fromIndex: number, toIndex: number) => {
    if (!activeMatrix) return;
    if (fromIndex < 0 || fromIndex >= activeMatrix.layers.length || toIndex < 0 || toIndex >= activeMatrix.layers.length) return;

    const nextLayers = activeMatrix.layers.slice();
    const [moved] = nextLayers.splice(fromIndex, 1);
    nextLayers.splice(toIndex, 0, moved);

    const nextMatrices = history.present.matrices.map((m) =>
      m.id === activeMatrixId ? { ...m, layers: nextLayers } : m
    );

    const nextState = {
      ...history.present,
      matrices: nextMatrices,
    };

    history.commit(nextState);
  }, [history, activeMatrixId, activeMatrix]);

  const renameLayer = useCallback((id: string, newName: string) => {
    if (!activeMatrix) return;
    const trimmed = newName.trim();
    if (!trimmed) {
      return;
    }
    const nextLayers = activeMatrix.layers.map((layer) =>
      layer.id === id ? { ...layer, name: trimmed } : layer
    );
    const nextMatrices = history.present.matrices.map((m) =>
      m.id === activeMatrixId ? { ...m, layers: nextLayers } : m
    );
    const nextState = {
      ...history.present,
      matrices: nextMatrices,
    };
    history.commit(nextState);
  }, [history, activeMatrixId, activeMatrix]);

  const mergeLayerDown = useCallback((id: string) => {
    if (!activeMatrix) return;
    const index = activeMatrix.layers.findIndex((layer) => layer.id === id);
    if (index <= 0) {
      return;
    }

    const lowerLayer = activeMatrix.layers[index - 1];
    const currentLayer = activeMatrix.layers[index];

    const nextFrames = activeMatrix.frames.map((frame) => {
      const resolvedLower = resolveCelHelper(history.present, frame.id, lowerLayer.id);
      const resolvedCurrent = resolveCelHelper(history.present, frame.id, currentLayer.id);

      const lowerPixels = resolvedLower ? resolvedLower.cel.pixels : Array.from<Pixel>({ length: width * height }).fill(null);
      const currentPixels = resolvedCurrent ? resolvedCurrent.cel.pixels : Array.from<Pixel>({ length: width * height }).fill(null);

      const nextPixels = lowerPixels.slice();
      currentPixels.forEach((color, i) => {
        if (color) {
          nextPixels[i] = color;
        }
      });

      const nextCels = frame.cels.map((cel) => {
        if (cel.layerId === lowerLayer.id) {
          return { ...cel, pixels: nextPixels, linkedToFrameId: undefined };
        }
        return cel;
      }).filter((cel) => cel.layerId !== currentLayer.id);

      return {
        ...frame,
        cels: nextCels,
      };
    });

    const nextLayers = activeMatrix.layers.filter((l) => l.id !== id);

    const updatedActiveMatrix = {
      ...activeMatrix,
      layers: nextLayers,
      frames: nextFrames,
    };

    const nextMatrices = history.present.matrices.map((m) =>
      m.id === activeMatrixId ? updatedActiveMatrix : m
    );

    const nextState = {
      ...history.present,
      matrices: nextMatrices,
    };

    history.commit(nextState);
    setActiveLayerId(lowerLayer.id);
  }, [history, setActiveLayerId, width, height, activeMatrixId, activeMatrix]);

  useEffect(() => {
    if (activeTool !== "selection") {
      setSelectionRect(null);
      setShowCopiedSelectionStamp(false);
    }
  }, [activeTool]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const activeEl = document.activeElement;
      const isTextInput = !!activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA");

      if (isTextInput && (key === "c" || key === "v" || key === "x")) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === "c") {
        if (selectionRect) {
          event.preventDefault();
          copySelection();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === "v") {
        if (copiedSelectionData) {
          event.preventDefault();
          pasteSelection();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === "x") {
        if (selectionRect) {
          event.preventDefault();
          cutSelection();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          history.redo();
        } else {
          history.undo();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === "y") {
        event.preventDefault();
        history.redo();
        return;
      }

      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        return;
      }

      if (key === shortcuts.pencil?.toLowerCase()) setActiveTool("pencil");
      else if (key === shortcuts.eraser?.toLowerCase()) setActiveTool("eraser");
      else if (key === shortcuts.bucket?.toLowerCase()) setActiveTool("bucket");
      else if (key === shortcuts.eyedropper?.toLowerCase()) setActiveTool("eyedropper");
      else if (key === shortcuts.line?.toLowerCase()) setActiveTool("line");
      else if (key === shortcuts.rectangle?.toLowerCase()) setActiveTool("rectangle");
      else if (key === shortcuts.ellipse?.toLowerCase()) setActiveTool("ellipse");
      else if (key === shortcuts.lighten?.toLowerCase()) setActiveTool("lighten");
      else if (key === shortcuts.darken?.toLowerCase()) setActiveTool("darken");
      else if (key === shortcuts.selection?.toLowerCase()) setActiveTool("selection");
      else if (key === "escape") {
        setSelectionRect(null);
      }
      else if (key === shortcuts.brushSizeDecrease?.toLowerCase()) setBrushSizeState((value) => Math.max(1, value - 1));
      else if (key === shortcuts.brushSizeIncrease?.toLowerCase()) setBrushSizeState((value) => Math.min(8, value + 1));
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [copiedSelectionData, copySelection, cutSelection, history, pasteSelection, selectionRect, shortcuts]);

  const getResolvedCel = useCallback((frameId: string, layerId: string) => {
    return resolveCelHelper(history.present, frameId, layerId);
  }, [history.present]);

  const linkCelToPrevious = useCallback((frameId: string, layerId: string) => {
    const activeMatrix = history.present.matrices.find((m) => m.id === activeMatrixId);
    if (!activeMatrix) return;

    const activeIndex = activeMatrix.frames.findIndex((f) => f.id === frameId);
    if (activeIndex <= 0) return; // Need a previous frame to link to

    const prevFrameId = activeMatrix.frames[activeIndex - 1].id;

    const nextFrames = activeMatrix.frames.map((frame) => {
      if (frame.id !== frameId) return frame;
      return {
        ...frame,
        cels: frame.cels.map((cel) => {
          if (cel.layerId !== layerId) return cel;
          return {
            ...cel,
            linkedToFrameId: prevFrameId,
            pixels: [], // Clear local pixels to avoid mismatch
          };
        }),
      };
    });

    const nextMatrices = history.present.matrices.map((m) => {
      if (m.id === activeMatrixId) {
        return { ...m, frames: nextFrames };
      }
      return m;
    });

    const nextState = {
      ...history.present,
      matrices: nextMatrices,
    };
    history.commit(nextState);
  }, [history, activeMatrixId]);

  const unlinkCel = useCallback((frameId: string, layerId: string) => {
    const resolved = resolveCelHelper(history.present, frameId, layerId);
    const pixelsCopy = resolved ? resolved.cel.pixels.slice() : Array.from<Pixel>({ length: width * height }).fill(null);

    const activeMatrix = history.present.matrices.find((m) => m.id === activeMatrixId);
    if (!activeMatrix) return;

    const nextFrames = activeMatrix.frames.map((frame) => {
      if (frame.id !== frameId) return frame;
      return {
        ...frame,
        cels: frame.cels.map((cel) => {
          if (cel.layerId !== layerId) return cel;
          return {
            ...cel,
            linkedToFrameId: undefined,
            pixels: pixelsCopy,
          };
        }),
      };
    });

    const nextMatrices = history.present.matrices.map((m) => {
      if (m.id === activeMatrixId) {
        return { ...m, frames: nextFrames };
      }
      return m;
    });

    const nextState = {
      ...history.present,
      matrices: nextMatrices,
    };
    history.commit(nextState);
  }, [history, width, height, activeMatrixId]);

  const clearCel = useCallback((frameId: string, layerId: string) => {
    const activeMatrix = history.present.matrices.find((m) => m.id === activeMatrixId);
    if (!activeMatrix) return;

    const nextFrames = activeMatrix.frames.map((frame) => {
      if (frame.id !== frameId) return frame;
      return {
        ...frame,
        cels: frame.cels.map((cel) => {
          if (cel.layerId !== layerId) return cel;
          return {
            ...cel,
            linkedToFrameId: undefined,
            pixels: Array.from<Pixel>({ length: width * height }).fill(null),
          };
        }),
      };
    });

    const nextMatrices = history.present.matrices.map((m) => {
      if (m.id === activeMatrixId) {
        return { ...m, frames: nextFrames };
      }
      return m;
    });

    const nextState = {
      ...history.present,
      matrices: nextMatrices,
    };
    history.commit(nextState);
  }, [history, width, height, activeMatrixId]);

  // FrameTag CRUD operations
  const addFrameTag = useCallback((name: string, from: number, to: number, color: string) => {
    const activeMatrix = history.present.matrices.find((m) => m.id === activeMatrixId);
    if (!activeMatrix) return;

    const nextId = `tag-${Date.now()}`;
    const newTag: FrameTag = {
      id: nextId,
      name,
      from,
      to,
      color,
    };

    const nextMatrices = history.present.matrices.map((m) => {
      if (m.id === activeMatrixId) {
        return {
          ...m,
          tags: [...(m.tags || []), newTag],
        };
      }
      return m;
    });

    const nextState = {
      ...history.present,
      matrices: nextMatrices,
    };
    history.commit(nextState);
  }, [history, activeMatrixId]);

  const deleteFrameTag = useCallback((id: string) => {
    const activeMatrix = history.present.matrices.find((m) => m.id === activeMatrixId);
    if (!activeMatrix) return;

    const nextMatrices = history.present.matrices.map((m) => {
      if (m.id === activeMatrixId) {
        return {
          ...m,
          tags: (m.tags || []).filter((tag) => tag.id !== id),
        };
      }
      return m;
    });

    const nextState = {
      ...history.present,
      matrices: nextMatrices,
    };
    history.commit(nextState);
  }, [history, activeMatrixId]);

  const updateFrameTag = useCallback((id: string, name: string, from: number, to: number, color: string) => {
    const activeMatrix = history.present.matrices.find((m) => m.id === activeMatrixId);
    if (!activeMatrix) return;

    const nextMatrices = history.present.matrices.map((m) => {
      if (m.id === activeMatrixId) {
        return {
          ...m,
          tags: (m.tags || []).map((tag) =>
            tag.id === id ? { ...tag, name, from, to, color } : tag
          ),
        };
      }
      return m;
    });

    const nextState = {
      ...history.present,
      matrices: nextMatrices,
    };
    history.commit(nextState);
  }, [history, activeMatrixId]);

  const addMatrix = useCallback(() => {
    const nextId = `matrix-${Date.now()}`;
    const newMatrix = createDefaultMatrix(nextId, `Animation ${history.present.matrices.length + 1}`, width, height);

    const nextState = {
      ...history.present,
      matrices: [...history.present.matrices, newMatrix],
      activeMatrixId: nextId,
    };

    history.commit(nextState);
    setActiveMatrixIdState(nextId);
    setActiveFrameId(newMatrix.frames[0].id);
    setActiveLayerId(newMatrix.layers[0].id);
  }, [width, height, history]);

  const deleteMatrix = useCallback((id: string) => {
    if (history.present.matrices.length <= 1) {
      return;
    }

    const nextMatrices = history.present.matrices.filter((m) => m.id !== id);
    const deletedIndex = history.present.matrices.findIndex((m) => m.id === id);

    const fallbackIndex = Math.max(0, deletedIndex - 1);
    const fallbackMatrix = nextMatrices[fallbackIndex];

    const nextState = {
      ...history.present,
      matrices: nextMatrices,
      activeMatrixId: fallbackMatrix.id,
    };

    history.commit(nextState);
    setActiveMatrixIdState(fallbackMatrix.id);
    if (fallbackMatrix.frames.length > 0) {
      setActiveFrameId(fallbackMatrix.frames[0].id);
    }
  }, [history]);

  const renameMatrix = useCallback((id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const nextMatrices = history.present.matrices.map((m) =>
      m.id === id ? { ...m, name: trimmed } : m
    );

    const nextState = {
      ...history.present,
      matrices: nextMatrices,
    };

    history.commit(nextState);
  }, [history]);

  const loadProject = useCallback((projectData: any) => {
    try {
      const { width: loadedWidth, height: loadedHeight, layers: loadedLayers, matrices: loadedMatrices, activeMatrixId: loadedActiveMatrixId } = projectData;

      if (!loadedWidth || !loadedHeight || !loadedMatrices) {
        throw new Error("Invalid project structure");
      }

      setWidth(loadedWidth);
      setHeight(loadedHeight);

      // Backward compatibility: Migrate global layers to matrix-local layers if they don't have them
      const migratedMatrices = loadedMatrices.map((matrix: any) => {
        if (!matrix.layers) {
          return {
            ...matrix,
            layers: loadedLayers ? JSON.parse(JSON.stringify(loadedLayers)) : [
              { id: "default-layer", name: "Layer 1", visible: true }
            ],
          };
        }
        return matrix;
      });

      const nextState: CanvasState = {
        matrices: migratedMatrices,
        activeMatrixId: loadedActiveMatrixId || loadedMatrices[0].id,
      };

      workingStateRef.current = nextState;
      setActiveMatrixIdState(nextState.activeMatrixId);
      const firstMatrix = nextState.matrices.find((m) => m.id === nextState.activeMatrixId) || nextState.matrices[0];
      if (firstMatrix && firstMatrix.frames.length > 0) {
        setActiveFrameId(firstMatrix.frames[0].id);
      }
      if (firstMatrix && firstMatrix.layers.length > 0) {
        setActiveLayerId(firstMatrix.layers[0].id);
      }
      history.reset(nextState);
    } catch (error) {
      console.error("Failed to load project:", error);
      alert("Failed to load project file. Please verify it is a valid .dotproj file.");
    }
  }, [history]);

  const importFramesToMatrix = useCallback((matrixId: string, framesPixels: Pixel[][]) => {
    let targetMatrix = history.present.matrices.find((m) => m.id === matrixId);
    let nextMatrices = history.present.matrices.slice();
    let targetId = matrixId;

    if (matrixId === "new") {
      targetId = `matrix-${Date.now()}`;
      targetMatrix = createDefaultMatrix(targetId, `Imported ${history.present.matrices.length + 1}`, width, height);
      targetMatrix.frames = []; // Clear default frame to load imported ones
      nextMatrices.push(targetMatrix);
    }

    if (!targetMatrix) return;

    const isSingleDefault = targetMatrix.frames.length === 1 && 
      targetMatrix.frames[0].cels.every(c => !c.linkedToFrameId && c.pixels.every(p => p === null));

    const newFrames = framesPixels.map((pixels, idx) => {
      const frameId = `frame-${Date.now()}-${idx}`;
      const cels = targetMatrix!.layers.map((layer) => {
        const isTargetLayer = layer.id === activeLayerId;
        return {
          layerId: layer.id,
          pixels: isTargetLayer ? pixels.slice() : Array.from<Pixel>({ length: width * height }).fill(null),
        };
      });
      return {
        id: frameId,
        cels,
      };
    });

    const nextFrames = (isSingleDefault || targetMatrix.frames.length === 0) ? newFrames : [...targetMatrix.frames, ...newFrames];

    nextMatrices = nextMatrices.map((m) => {
      if (m.id === targetId) {
        return { ...m, frames: nextFrames };
      }
      return m;
    });

    const nextState = {
      ...history.present,
      matrices: nextMatrices,
      activeMatrixId: targetId,
    };

    history.commit(nextState);
    setActiveMatrixIdState(targetId);
    if (newFrames.length > 0) {
      setActiveFrameId(newFrames[0].id);
    }
  }, [width, height, history, activeLayerId]);

  return useMemo(
    () => ({
      activeTool,
      background,
      brushSize,
      canRedo: history.canRedo,
      canUndo: history.canUndo,
      cursorPoint,
      foreground,
      handleContextMenu: (event: MouseEvent<HTMLCanvasElement>) => event.preventDefault(),
      handlePointerDown,
      handlePointerLeave: () => setCursorPoint(null),
      handlePointerMove,
      handlePointerUp: stopDrawing,
      height,
      hoverPoints: cursorPoint && activeTool !== "selection" ? getBrushPreviewPoints(cursorPoint, brushSize, mirrorX, mirrorY) : [],
      pixels: combinedPixels,
      selectionRect,
      
      // Multi-frame state getters and setters
      matrices: history.present.matrices,
      activeMatrixId,
      setActiveMatrixId,
      addMatrix,
      deleteMatrix,
      renameMatrix,
      loadProject,
      importFramesToMatrix,
      frames: activeMatrix.frames,
      activeFrameId,
      setActiveFrameId,
      isPlaying,
      setIsPlaying,
      fps,
      setFps,
      onionSkinPixels,
 
      // Layers are mapped to the active frame
      layers: activeFrameLayers,
      activeLayerId,
      setActiveLayerId,
      redo: history.redo,
      setActiveTool,
      setBackground,
      setBrushSize,
      setForeground,
      setMirrorX,
      setMirrorY,
      setOpacity,
      clearSelection: () => {
        setSelectionRect(null);
        setShowCopiedSelectionStamp(false);
      },
      copySelection,
      cutSelection,
      deleteSelection,
      flipSelection,
      pasteSelection,
      hasCopiedSelection: copiedSelectionData !== null,
      selectionMoveContentsMode,
      setSelectionMoveContentsMode,
      copiedSelectionStamp: showCopiedSelectionStamp && copiedSelectionData
        ? {
            height: copiedSelectionData.rect.height,
            pixels: copiedSelectionData.pixels,
            width: copiedSelectionData.rect.width,
          }
        : null,
      mirrorX,
      mirrorY,
      opacity,
      undo: history.undo,
      width,
      resizeCanvas,
      clearCanvas,
      importCanvas,
      addLayer,
      deleteLayer,
      toggleLayerVisibility,
      reorderLayer,
      reorderLayerTo,
      renameLayer,
      mergeLayerDown,
 
      // Frame controls
      addFrame,
      duplicateFrame,
      deleteFrame,
      reorderFrame,
      reorderFrameTo,
 
      // Linked cels
      getResolvedCel,
      linkCelToPrevious,
      unlinkCel,
      clearCel,
 
      // Frame tags
      tags: activeMatrix.tags || [],
      addFrameTag,
      deleteFrameTag,
      updateFrameTag,

      // New: Copy/Paste frame state
      copyFrame,
      pasteFrame,
      hasCopiedFrame: copiedFrameData !== null,
      dimInactiveLayers,
      setDimInactiveLayers,

      // Shortcuts
      shortcuts,
      updateShortcut,
      resetShortcuts,
    }),
    [
      activeTool,
      background,
      brushSize,
      cursorPoint,
      foreground,
      handlePointerDown,
      handlePointerMove,
      history.canRedo,
      history.canUndo,
      history.present,
      history.redo,
      history.undo,
      mirrorX,
      mirrorY,
      opacity,
      setBrushSize,
      setOpacity,
      stopDrawing,
      width,
      height,
      getBrushPreviewPoints,
      resizeCanvas,
      clearCanvas,
      importCanvas,
      combinedPixels,
      activeMatrixId,
      addMatrix,
      deleteMatrix,
      renameMatrix,
      loadProject,
      importFramesToMatrix,
      selectionRect,
      copiedSelectionData,
      showCopiedSelectionStamp,
      selectionMoveContentsMode,
      copySelection,
      cutSelection,
      deleteSelection,
      flipSelection,
      pasteSelection,
      activeMatrix,
      activeFrameId,
      isPlaying,
      fps,
      onionSkinPixels,
      activeFrameLayers,
      activeLayerId,
      addLayer,
      deleteLayer,
      toggleLayerVisibility,
      reorderLayer,
      reorderLayerTo,
      renameLayer,
      mergeLayerDown,
      addFrame,
      duplicateFrame,
      deleteFrame,
      reorderFrame,
      reorderFrameTo,
      getResolvedCel,
      linkCelToPrevious,
      unlinkCel,
      clearCel,
      addFrameTag,
      deleteFrameTag,
      updateFrameTag,
      copyFrame,
      pasteFrame,
      copiedFrameData,
      dimInactiveLayers,
      shortcuts,
      updateShortcut,
      resetShortcuts,
    ],
  );
}

function getPaintColor(color: string, opacity: number) {
  if (opacity >= 100) {
    return color;
  }

  const hex = color.replace("#", "");
  const normalizedHex =
    hex.length === 3
      ? hex
          .split("")
          .map((character) => character + character)
          .join("")
      : hex;
  const red = Number.parseInt(normalizedHex.slice(0, 2), 16);
  const green = Number.parseInt(normalizedHex.slice(2, 4), 16);
  const blue = Number.parseInt(normalizedHex.slice(4, 6), 16);

  return `rgba(${red}, ${green}, ${blue}, ${opacity / 100})`;
}

function getToneAdjustedColor(color: Pixel, direction: "lighten" | "darken") {
  const currentHex = normalizeColorToHex(color);

  if (!currentHex) {
    return null;
  }

  const currentHsl = rgbToHsl(hexToRgb(currentHex));
  const step = 0.06;
  const nextHsl = {
    ...currentHsl,
    l: clamp(currentHsl.l + (direction === "lighten" ? step : -step), 0, 1),
  };
  const nextHex = hslToHex(nextHsl);

  return nextHex.toLowerCase() === currentHex.toLowerCase() ? null : nextHex;
}

function normalizeColorToHex(color: Pixel) {
  if (!color) {
    return null;
  }

  const trimmed = color.trim().toLowerCase();

  if (/^#[0-9a-f]{6}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^#[0-9a-f]{3}$/.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split("")
      .map((character) => character + character)
      .join("")}`;
  }

  const rgbaMatch = trimmed.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/);

  if (!rgbaMatch) {
    return null;
  }

  const [, red, green, blue] = rgbaMatch;

  return `#${[red, green, blue]
    .map((channel) => clamp(Number(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hexToRgb(color: string) {
  return {
    r: Number.parseInt(color.slice(1, 3), 16),
    g: Number.parseInt(color.slice(3, 5), 16),
    b: Number.parseInt(color.slice(5, 7), 16),
  };
}

function rgbToHsl({ b, g, r }: { b: number; g: number; r: number }) {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  let hue = 0;
  let saturation = 0;

  if (delta !== 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));

    if (max === red) {
      hue = ((green - blue) / delta) % 6;
    } else if (max === green) {
      hue = (blue - red) / delta + 2;
    } else {
      hue = (red - green) / delta + 4;
    }

    hue *= 60;
    if (hue < 0) {
      hue += 360;
    }
  }

  return {
    h: hue,
    s: saturation,
    l: lightness,
  };
}

function hslToHex({ h, l, s }: { h: number; l: number; s: number }) {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (h < 60) [red, green, blue] = [chroma, x, 0];
  else if (h < 120) [red, green, blue] = [x, chroma, 0];
  else if (h < 180) [red, green, blue] = [0, chroma, x];
  else if (h < 240) [red, green, blue] = [0, x, chroma];
  else if (h < 300) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];

  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function isShapeTool(tool: Tool) {
  return tool === "line" || tool === "rectangle" || tool === "ellipse";
}

function createSelectionRect(start: PixelPoint, end: PixelPoint, width: number, height: number): SelectionRect {
  const left = clamp(Math.min(start.x, end.x), 0, width - 1);
  const right = clamp(Math.max(start.x, end.x), 0, width - 1);
  const top = clamp(Math.min(start.y, end.y), 0, height - 1);
  const bottom = clamp(Math.max(start.y, end.y), 0, height - 1);

  return {
    x: left,
    y: top,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

function clampSelectionRect(rect: SelectionRect, width: number, height: number): SelectionRect {
  return {
    ...rect,
    x: clamp(rect.x, 0, Math.max(0, width - rect.width)),
    y: clamp(rect.y, 0, Math.max(0, height - rect.height)),
  };
}

function isPointInSelection(point: PixelPoint, rect: SelectionRect) {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  );
}

function getLinePoints(start: PixelPoint, end: PixelPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const steps = Math.max(Math.abs(dx), Math.abs(dy), 1);
  const points = new Map<string, PixelPoint>();

  for (let step = 0; step <= steps; step += 1) {
    const point = {
      x: Math.round(start.x + (dx * step) / steps),
      y: Math.round(start.y + (dy * step) / steps),
    };
    points.set(`${point.x},${point.y}`, point);
  }

  return [...points.values()];
}

function getRectanglePoints(start: PixelPoint, end: PixelPoint) {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  const points = new Map<string, PixelPoint>();

  for (let x = left; x <= right; x += 1) {
    points.set(`${x},${top}`, { x, y: top });
    points.set(`${x},${bottom}`, { x, y: bottom });
  }

  for (let y = top; y <= bottom; y += 1) {
    points.set(`${left},${y}`, { x: left, y });
    points.set(`${right},${y}`, { x: right, y });
  }

  return [...points.values()];
}

function getEllipsePoints(start: PixelPoint, end: PixelPoint) {
  const left = Math.min(start.x, end.x);
  const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y);
  const bottom = Math.max(start.y, end.y);
  const boxWidth = right - left + 1;
  const boxHeight = bottom - top + 1;
  const radiusX = boxWidth / 2;
  const radiusY = boxHeight / 2;

  if (boxWidth <= 1 || boxHeight <= 1) {
    return getLinePoints(start, end);
  }

  const centerX = left + radiusX;
  const centerY = top + radiusY;
  const innerRadiusX = Math.max(radiusX - 1, 0);
  const innerRadiusY = Math.max(radiusY - 1, 0);
  const points = new Map<string, PixelPoint>();

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const centerOffsetX = x + 0.5 - centerX;
      const centerOffsetY = y + 0.5 - centerY;
      const outerValue =
        (centerOffsetX * centerOffsetX) / (radiusX * radiusX) +
        (centerOffsetY * centerOffsetY) / (radiusY * radiusY);

      if (outerValue > 1) {
        continue;
      }

      const innerValue =
        innerRadiusX === 0 || innerRadiusY === 0
          ? Number.POSITIVE_INFINITY
          : (centerOffsetX * centerOffsetX) / (innerRadiusX * innerRadiusX) +
            (centerOffsetY * centerOffsetY) / (innerRadiusY * innerRadiusY);

      if (innerValue >= 1) {
        points.set(`${x},${y}`, { x, y });
      }
    }
  }

  return [...points.values()];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
