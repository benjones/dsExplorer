import { createDataTypeBlock, DATA_TYPE_BLOCK_WIDTH, type DataTypeBlock } from "./data-type-block.js";
const ARRAY_PADDING = 16;
const BLOCK_GAP = 8;

export type { DataTypeBlock } from "./data-type-block.js";

export interface DataTypeField {
  kind: DataTypeBlock;
  label: string;
}

export interface SavedDataType {
  name: string;
  elements: DataTypeField[];
}

function svgElement(name: string, attributes: Record<string, string>): SVGElement {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

export function createDataTypeDiagram(dataType: SavedDataType, { showName = true }: { showName?: boolean } = {}): SVGSVGElement {
  const { elements, name } = dataType;
  const contentWidth = elements.reduce((total, field) => total + DATA_TYPE_BLOCK_WIDTH[field.kind] * 0.5, 0) + Math.max(0, elements.length - 1) * BLOCK_GAP;
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

  let cursor = 4 + (arrayWidth - contentWidth) / 2;
  for (const field of elements) {
    const width = DATA_TYPE_BLOCK_WIDTH[field.kind] * 0.5;
    const x = cursor + width / 2;
    svg.append(createDataTypeBlock(field.kind, x, 48, 0.5));
    if (field.label) {
      const label = svgElement("text", { x: String(x), y: "85", "text-anchor": "middle", fill: "var(--color-muted)", "font-size": "8" });
      label.textContent = field.label;
      svg.append(label);
    }
    cursor += width + BLOCK_GAP;
  }
  return svg;
}
