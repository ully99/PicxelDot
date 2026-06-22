import {
  MouseEvent,
  PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Pixel, PixelPoint, Tool, Layer, Frame, Cel, CanvasState, FrameTag, Matrix } from "../types";
import { useHistory } from "./useHistory";

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
  const [mirrorX, setMirrorX] = useState(false);
  const [mirrorY, setMirrorY] = useState(false);
  const [opacity, setOpacityState] = useState(100);
  const [dimInactiveLayers, setDimInactiveLayers] = useState(false);
  const [copiedFrameData, setCopiedFrameData] = useState<{
    cels: { layerId: string; pixels: Pixel[] }[];
  } | null>(null);
  const lastPointRef = useRef<PixelPoint | null>(null);
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

  const drawAt = useCallback(
    (point: PixelPoint, fromPoint: PixelPoint | null) => {
      const color = strokeColorRef.current;
      const source = workingStateRef.current;
      const next = fromPoint ? drawLine(source, fromPoint, point, color) : applyBrush(source, point, color);

      if (next === source) {
        return;
      }

      workingStateRef.current = next;
      history.replace(next);
    },
    [applyBrush, drawLine, history],
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
      workingStateRef.current = history.present;
      strokeColorRef.current =
        activeTool === "eraser" || event.button === 2 ? null : getPaintColor(foreground, opacity);
      history.commit(history.present);
      drawAt(point, null);
    },
    [activeTool, bucketAt, drawAt, foreground, getPointFromEvent, history, opacity, pickColor],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const point = getPointFromEvent(event);
      setCursorPoint(point);

      if (!point || !isDrawingRef.current) {
        return;
      }

      drawAt(point, lastPointRef.current);
      lastPointRef.current = point;
    },
    [drawAt, getPointFromEvent],
  );

  const stopDrawing = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    isDrawingRef.current = false;
    lastPointRef.current = null;
  }, []);

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
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

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

      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        return;
      }

      if (key === "b") setActiveTool("pencil");
      if (key === "e") setActiveTool("eraser");
      if (key === "g") setActiveTool("bucket");
      if (key === "i") setActiveTool("eyedropper");
      if (key === "[") setBrushSizeState((value) => Math.max(1, value - 1));
      if (key === "]") setBrushSizeState((value) => Math.min(8, value + 1));
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history]);

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
      hoverPoints: cursorPoint ? getBrushPreviewPoints(cursorPoint, brushSize, mirrorX, mirrorY) : [],
      pixels: combinedPixels,
      
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
