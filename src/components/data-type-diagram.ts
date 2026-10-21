const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const ARRAY_PADDING = 16;
const BLOCK_GAP = 10;

export type DataTypeElement = "value" | "array" | "reference";

export interface SavedDataType {
  name: string;
  elements: DataTypeElement[];
}

function svgElement(name: string, attributes: Record<string, string>): SVGElement {
  const element = document.createElementNS(SVG_NAMESPACE, name);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function blockWidth(kind: DataTypeElement): number {
  if (kind === "array") return 76;
  if (kind === "reference") return 38;
  return 28;
}

function createBlock(kind: DataTypeElement, x: number): SVGElement {
  const block = svgElement("g", { transform: `translate(${x} 48)` });
  const rectAttributes = { fill: "var(--color-item-fill)", stroke: "var(--color-item-stroke)", "stroke-width": "1.25" };
  if (kind === "value") {
    block.append(svgElement("rect", { ...rectAttributes, x: "-14", y: "-14", width: "28", height: "28", rx: "4" }));
    const text = svgElement("text", { x: "0", y: "7", "text-anchor": "middle", fill: "var(--color-text)", "font-size": "16" });
    text.textContent = "?";
    block.append(text);
  } else if (kind === "array") {
    block.append(svgElement("rect", { ...rectAttributes, x: "-38", y: "-14", width: "76", height: "28", rx: "4" }));
    [-25.5, -12.5, 0.5, 13.5, 26.5].forEach((dividerX) => {
      block.append(svgElement("line", { x1: String(dividerX), x2: String(dividerX), y1: "-14", y2: "14", stroke: "var(--color-item-stroke)", "stroke-width": "1", opacity: "0.65" }));
    });
    ["1", "2", "…", "n−1", "n"].forEach((label, index) => {
      const text = svgElement("text", { x: String([-32, -19, -6, 9, 27][index]), y: "4", "text-anchor": "middle", fill: "var(--color-text)", "font-size": "7" });
      text.textContent = label;
      block.append(text);
    });
  } else {
    block.append(svgElement("rect", { ...rectAttributes, x: "-19", y: "-14", width: "38", height: "28", rx: "4" }));
  }
  return block;
}

export function createDataTypeDiagram(dataType: SavedDataType, { showName = true }: { showName?: boolean } = {}): SVGSVGElement {
  const { elements, name } = dataType;
  const contentWidth = elements.reduce((total, kind) => total + blockWidth(kind), 0) + Math.max(0, elements.length - 1) * BLOCK_GAP;
  const arrayWidth = Math.max(112, contentWidth + ARRAY_PADDING * 2);
  const svg = svgElement("svg", {
    class: "data-type-diagram",
    viewBox: `0 0 ${arrayWidth + 8} 96`,
    role: "img",
    "aria-label": name,
  }) as SVGSVGElement;
  svg.append(svgElement("rect", {
    x: "4",
    y: "0",
    width: String(arrayWidth),
    height: "96",
    rx: "8",
    fill: "var(--color-array)",
    stroke: "var(--color-item-stroke)",
    "stroke-width": "1.25",
  }));
  if (showName) {
    const title = svgElement("text", { x: String(arrayWidth / 2 + 4), y: "20", "text-anchor": "middle", fill: "var(--color-text)", "font-size": "12" });
    title.textContent = name;
    svg.append(title);
  }

  if (elements.length === 0) {
    const placeholder = svgElement("text", { x: String(arrayWidth / 2 + 4), y: "57", "text-anchor": "middle", fill: "var(--color-muted)", "font-size": "12" });
    placeholder.textContent = "Empty";
    svg.append(placeholder);
    return svg;
  }

  let cursor = 4 + ARRAY_PADDING;
  for (const kind of elements) {
    const width = blockWidth(kind);
    svg.append(createBlock(kind, cursor + width / 2));
    cursor += width + BLOCK_GAP;
  }
  return svg;
}
