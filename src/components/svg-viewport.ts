export interface SvgViewport {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

interface SvgViewportOptions {
  logicalHeight: number;
  minimumWidth?: number;
  centerX?: number;
  centerY?: number;
}

export function updateSvgViewport(
  canvas: SVGSVGElement,
  { logicalHeight, minimumWidth, centerX, centerY }: SvgViewportOptions,
): SvgViewport | undefined {
  const bounds = canvas.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) return undefined;

  const heightScale = bounds.height / logicalHeight;
  const widthScale = minimumWidth === undefined ? Number.POSITIVE_INFINITY : bounds.width / minimumWidth;
  const scale = Math.min(heightScale, widthScale);
  const width = bounds.width / scale;
  const height = bounds.height / scale;
  const x = centerX === undefined ? 0 : centerX - width / 2;
  const y = centerY === undefined ? 0 : centerY - height / 2;
  canvas.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
  return { x, y, width, height, scale };
}
