const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export const PALETTE_ENTRY_MIME = "application/x-ds-explorer-palette-entry";

export function createPlaceholderIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");

  const rect = document.createElementNS(SVG_NAMESPACE, "rect");
  rect.setAttribute("x", "3");
  rect.setAttribute("y", "3");
  rect.setAttribute("width", "18");
  rect.setAttribute("height", "18");
  rect.setAttribute("rx", "3");

  const path = document.createElementNS(SVG_NAMESPACE, "path");
  path.setAttribute("d", "M7 9h10M7 13h10M7 17h6");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.6");
  path.setAttribute("stroke-linecap", "round");
  svg.append(rect, path);
  return svg;
}

export class DataTypePaletteEntry extends HTMLElement {
  static observedAttributes = ["title"];

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.render();
  }

  private render(): void {
    const title = this.getAttribute("title") ?? "Untitled data type";
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host, *, *::before, *::after { box-sizing: border-box; }
        :host { display: block; }
        button {
          display: flex;
          align-items: center;
          width: 100%;
          gap: 0.6rem;
          border: 1px solid var(--color-control-border);
          border-radius: 0.35rem;
          padding: 0.5rem 0.65rem;
          color: var(--color-text);
          background: var(--color-control);
          text-align: left;
          font: inherit;
        }
        button:hover { background: var(--color-control-hover); cursor: grab; }
        svg { width: 1.2rem; height: 1.2rem; fill: none; stroke: currentColor; stroke-width: 1.6; }
      </style>
      <button type="button">
        <span></span>
      </button>
    `;
    const button = root.querySelector("button")!;
    button.draggable = true;
    button.prepend(createPlaceholderIcon());
    root.querySelector("span")!.textContent = title;
    button.addEventListener("dragstart", (event) => {
      if (!event.dataTransfer) return;
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData(PALETTE_ENTRY_MIME, title);
      event.dataTransfer.setData("text/plain", title);
    });
  }
}

customElements.define("data-type-palette-entry", DataTypePaletteEntry);
