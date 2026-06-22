import { KeyboardEvent, PointerEvent, useCallback, useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };

export function useCanvasTransform(initialZoom = 1) {
  const [zoom, setZoom] = useState(initialZoom);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const startPanRef = useRef<Point | null>(null);
  const startOffsetRef = useRef<Point>({ x: 0, y: 0 });

  // 키보드 Space 키 리스너 등록
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.code === "Space" && !event.repeat) {
        // 입력창 등에 포커싱이 가 있지 않은 경우에만 활성화
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.tagName === "SELECT")) {
          return;
        }
        event.preventDefault();
        setIsSpacePressed(true);
      }
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

  // 줌 초기화 함수
  const resetTransform = useCallback(() => {
    setZoom(initialZoom);
    setPanX(0);
    setPanY(0);
    setIsPanning(false);
  }, [initialZoom]);

  // 휠 스크롤 줌 처리
  // containerRef에 이벤트 핸들러를 바인딩하여 마우스 위치 중심 줌 계산
  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>, containerRect: DOMRect) => {
      event.preventDefault();

      // 마우스의 컨테이너 대비 상대 좌표
      const mouseX = event.clientX - containerRect.left - containerRect.width / 2;
      const mouseY = event.clientY - containerRect.top - containerRect.height / 2;

      // 새 줌 계산 (최소 1배, 최대 64배)
      const zoomFactor = 1.15;
      let nextZoom = zoom;

      if (event.deltaY < 0) {
        nextZoom = Math.min(64, zoom * zoomFactor);
      } else {
        nextZoom = Math.max(0.1, zoom / zoomFactor);
      }

      if (nextZoom === zoom) {
        return;
      }

      // 커서 위치 기준 줌 유지 공식 적용:
      // panX_new = mouseX - (mouseX - panX_old) * (zoom_new / zoom_old)
      const ratio = nextZoom / zoom;
      setPanX((currentX) => mouseX - (mouseX - currentX) * ratio);
      setPanY((currentY) => mouseY - (mouseY - currentY) * ratio);
      setZoom(nextZoom);
    },
    [zoom],
  );

  // 팬 시작 핸들러 (컨테이너 포인터 다운 시 호출)
  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      // Space 바가 눌려있거나, 마우스 휠 클릭(1)인 경우 팬 모드 돌입
      const isWheelClick = event.button === 1;
      if (isSpacePressed || isWheelClick) {
        event.currentTarget.setPointerCapture(event.pointerId);
        setIsPanning(true);
        startPanRef.current = { x: event.clientX, y: event.clientY };
        startOffsetRef.current = { x: panX, y: panY };
        event.stopPropagation();
      }
    },
    [isSpacePressed, panX, panY],
  );

  // 팬 이동 핸들러
  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
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

  // 팬 종료 핸들러
  const handlePointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setIsPanning(false);
      startPanRef.current = null;
      event.stopPropagation();
    }
  }, [isPanning]);

  return {
    zoom,
    panX,
    panY,
    isPanning,
    isSpacePressed,
    resetTransform,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
