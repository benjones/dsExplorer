const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export type DataTypeBlock = "value" | "array" | "reference";

function svgElement(name: string, attributes: Record<string, string>): SVGElement {
  const element = document.createElementNS(SVG_NAMESPACE, name);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

function svgSizeString(value: number, scale: number): string {
  return String(value * scale);
}

export const DATA_TYPE_BLOCK_WIDTH: Record<DataTypeBlock, number> = {
  value: 56,
  array: 152,
  reference: 76,
};

export function createDataTypeBlock(kind: DataTypeBlock, x: number, y: number, scale = 1): SVGGElement {
  const block = svgElement("g", {
    class: `data-type-block data-type-block-${kind}`,
    transform: `translate(${x} ${y})`,
  }) as SVGGElement;
  const rect = (attributes: Record<string, string>) => svgElement("rect", {
    fill: "var(--color-item-fill)",
    stroke: "var(--color-item-stroke)",
    "stroke-width": svgSizeString(1.25, scale),
    ...attributes,
  });
  const text = (content: string, textX: number, textY: number, fontSize: number) => {
    const node = svgElement("text", {
      x: svgSizeString(textX, scale),
      y: svgSizeString(textY, scale),
      "text-anchor": "middle",
      fill: "var(--color-text)",
      "font-size": svgSizeString(fontSize, scale),
    });
    node.textContent = content;
    return node;
  };

  if (kind === "value") {
    block.append(rect({ x: svgSizeString(-28, scale), y: svgSizeString(-22, scale), width: svgSizeString(56, scale), height: svgSizeString(44, scale), rx: svgSizeString(5, scale) }));
    block.append(text("?", 0, 8, 22));
  } else if (kind === "array") {
    block.append(rect({ x: svgSizeString(-76, scale), y: svgSizeString(-22, scale), width: svgSizeString(152, scale), height: svgSizeString(44, scale), rx: svgSizeString(5, scale) }));
    [-51.5, -32.5, -13.5, 5.5, 27.5, 51.5].forEach((dividerX) => {
      block.append(svgElement("line", {
        x1: svgSizeString(dividerX, scale), x2: svgSizeString(dividerX, scale), y1: svgSizeString(-22, scale), y2: svgSizeString(22, scale),
        stroke: "var(--color-item-stroke)", "stroke-width": svgSizeString(1, scale), opacity: "0.65",
      }));
    });
    ["1", "2", "…", "3", "…", "n−1", "n"].forEach((label, index) => {
      block.append(text(label, [-61, -42, -23, -4, 15, 40, 63][index], 5, 12));
    });
  } else {
    block.append(rect({ x: svgSizeString(-38, scale), y: svgSizeString(-22, scale), width: svgSizeString(76, scale), height: svgSizeString(44, scale), rx: svgSizeString(5, scale), "stroke-dasharray": `${svgSizeString(4, scale)} ${svgSizeString(3, scale)}` }));
  }
  return block;
}
