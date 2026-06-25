import { PointerEvent, useCallback, useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };
type GestureSnapshot = {
  center: Point;
  focus: Point;
  distance: number;
  panX: number;
  panY: number;
  zoom: number;
};

export function useCanvasTransform(initialZoom = 1) {
  const [zoom, setZoom] = useState(initialZoom);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isTouchGestureActive, setIsTouchGestureActive] = useState(false);

  const startPanRef = useRef<Point | null>(null);
  const startOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const touchPointersRef = useRef(new Map<number, Point>());
  const gestureStartRef = useRef<GestureSnapshot | null>(null);
  const isTouchGestureActiveRef = useRef(false);
  const blockTouchDrawingUntilRef = useRef(0);

  const blockTouchDrawingBriefly = useCallback(() => {
    blockTouchDrawingUntilRef.current = Date.now() + 240;
  }, []);

  const setTouchGestureActive = useCallback(
    (active: boolean) => {
      isTouchGestureActiveRef.current = active;
      setIsTouchGestureActive(active);
      if (active) {
        blockTouchDrawingBriefly();
      }
    },
    [blockTouchDrawingBriefly],
  );

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) {
        return;
      }

      const activeEl = document.activeElement;
      if (activeEl && ["INPUT", "TEXTAREA", "SELECT"].includes(activeEl.tagName)) {
        return;
      }

      event.preventDefault();
      setIsSpacePressed(true);
    };

    const handleKeyUp = (event: globalThis.KeyboardEvent) => {
      if (event.code === "Space") {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const resetTransform = useCallback(() => {
    setZoom(initialZoom);
    setPanX(0);
    setPanY(0);
    setIsPanning(false);
    setTouchGestureActive(false);
    blockTouchDrawingUntilRef.current = 0;
    gestureStartRef.current = null;
    touchPointersRef.current.clear();
  }, [initialZoom, setTouchGestureActive]);

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>, containerRect: DOMRect) => {
      event.preventDefault();

      const mouseX = event.clientX - containerRect.left - containerRect.width / 2;
      const mouseY = event.clientY - containerRect.top - containerRect.height / 2;
      const zoomFactor = 1.15;
      const nextZoom = event.deltaY < 0 ? Math.min(64, zoom * zoomFactor) : Math.max(0.1, zoom / zoomFactor);

      if (nextZoom === zoom) {
        return;
      }

      const ratio = nextZoom / zoom;
      setPanX((currentX) => mouseX - (mouseX - currentX) * ratio);
      setPanY((currentY) => mouseY - (mouseY - currentY) * ratio);
      setZoom(nextZoom);
    },
    [zoom],
  );

  const getTouchGesture = () => {
    const points = Array.from(touchPointersRef.current.values());
    if (points.length < 2) {
      return null;
    }

    const [a, b] = points;
    const center = {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    };
    const distance = Math.hypot(a.x - b.x, a.y - b.y);

    return { center, distance };
  };

  const getGestureFocus = (center: Point, rect: DOMRect) => ({
    x: center.x - rect.left - rect.width / 2,
    y: center.y - rect.top - rect.height / 2,
  });

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>, containerRect?: DOMRect) => {
      if (event.pointerType === "touch") {
        touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

        const gesture = getTouchGesture();
        if (gesture) {
          const rect = containerRect ?? event.currentTarget.getBoundingClientRect();
          event.currentTarget.setPointerCapture(event.pointerId);
          gestureStartRef.current = {
            ...gesture,
            focus: getGestureFocus(gesture.center, rect),
            panX,
            panY,
            zoom,
          };
          setIsPanning(true);
          setTouchGestureActive(true);
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      const isWheelClick = event.button === 1;
      if (isSpacePressed || isWheelClick) {
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsPanning(true);
        startPanRef.current = { x: event.clientX, y: event.clientY };
        startOffsetRef.current = { x: panX, y: panY };
        event.stopPropagation();
      }
    },
    [isSpacePressed, panX, panY, setTouchGestureActive, zoom],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>, containerRect?: DOMRect) => {
      if (event.pointerType === "touch" && touchPointersRef.current.has(event.pointerId)) {
        touchPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const gesture = getTouchGesture();
        const start = gestureStartRef.current;

        if (gesture && start) {
          const rect = containerRect ?? event.currentTarget.getBoundingClientRect();
          const focus = getGestureFocus(gesture.center, rect);
          const ratio = gesture.distance / Math.max(1, start.distance);
          const nextZoom = Math.max(0.1, Math.min(64, start.zoom * ratio));
          const startContentX = (start.focus.x - start.panX) / start.zoom;
          const startContentY = (start.focus.y - start.panY) / start.zoom;

          setZoom(nextZoom);
          setPanX(focus.x - startContentX * nextZoom);
          setPanY(focus.y - startContentY * nextZoom);
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }

      if (!isPanning || !startPanRef.current) {
        return;
      }

      const dx = event.clientX - startPanRef.current.x;
      const dy = event.clientY - startPanRef.current.y;

      setPanX(startOffsetRef.current.x + dx);
      setPanY(startOffsetRef.current.y + dy);
      event.stopPropagation();
    },
    [isPanning],
  );

  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") {
      touchPointersRef.current.delete(event.pointerId);
      if (touchPointersRef.current.size < 2) {
        gestureStartRef.current = null;
        setIsPanning(false);
        setTouchGestureActive(false);
        blockTouchDrawingBriefly();
      }
      return;
    }

    if (isPanning) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setIsPanning(false);
      startPanRef.current = null;
      event.stopPropagation();
    }
  }, [blockTouchDrawingBriefly, isPanning, setTouchGestureActive]);

  const shouldBlockTouchDrawing = useCallback(() => {
    return (
      isTouchGestureActiveRef.current ||
      touchPointersRef.current.size >= 2 ||
      Date.now() < blockTouchDrawingUntilRef.current
    );
  }, []);

  return {
    zoom,
    setZoom,
    panX,
    panY,
    isPanning,
    isSpacePressed,
    isTouchGestureActive,
    shouldBlockTouchDrawing,
    resetTransform,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
