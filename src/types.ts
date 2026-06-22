export type Tool = "pencil" | "eraser" | "bucket" | "eyedropper";

export type Pixel = string | null;

export type PixelPoint = {
  x: number;
  y: number;
};

export type Layer = {
  id: string;
  name: string;
  visible: boolean;
};

export type Cel = {
  layerId: string;
  pixels: Pixel[];
  linkedToFrameId?: string; // Links this cel to another frame's cel for shared pixels
};

export type Frame = {
  id: string;
  cels: Cel[];
};

export type FrameTag = {
  id: string;
  name: string;
  from: number; // 0-based start frame index
  to: number;   // 0-based end frame index (inclusive)
  color: string;
};

export type Matrix = {
  id: string;
  name: string;
  layers: Layer[];
  frames: Frame[];
  tags: FrameTag[];
};

export type CanvasState = {
  matrices: Matrix[];
  activeMatrixId: string;
};


