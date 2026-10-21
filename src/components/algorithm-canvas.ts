import { PALETTE_ENTRY_MIME } from "./data-type-palette-entry.js";
import { createDataTypeDiagram, type SavedDataType } from "./data-type-diagram.js";
import { updateSvgViewport } from "./svg-viewport.js";

export class AlgorithmCanvas extends HTMLElement {
  private activeItem?: { icon: SVGSVGElement; pointerId: number; offsetX: number; offsetY: number };
  private resizeObserver?: ResizeObserver;
  private viewportX = 0;
  private viewportWidth = 800;
  private viewportScale = 1;

  connectedCallback(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <link rel="stylesheet" href="${new URL("./algorithm-canvas.css", import.meta.url).href}" />
      <section class="panel" aria-labelledby="canvas-title">
        <div class="heading">
          <h1 id="canvas-title">Algorithm canvas</h1>
          <span>Choose a data type to begin</span>
        </div>
        <svg class="canvas" viewBox="0 0 800 440" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Algorithm canvas">
          <rect x="1" y="1" width="798" height="438" rx="10" class="canvas-border"></rect>
          <text class="canvas-hint" x="400" y="220" text-anchor="middle">Drag a data type here</text>
          <g class="canvas-items"></g>
        </svg>
      </section>
    `;
    const canvas = root.querySelector<SVGSVGElement>(".canvas")!;
    canvas.addEventListener("dragover", (event) => {
      if (!event.dataTransfer?.types.includes(PALETTE_ENTRY_MIME)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      canvas.classList.add("is-drop-target");
    });
    canvas.addEventListener("dragleave", () => canvas.classList.remove("is-drop-target"));
    canvas.addEventListener("drop", (event) => this.dropEntry(event, canvas));
    canvas.addEventListener("pointerdown", (event) => this.startItemDrag(event, canvas));
    canvas.addEventListener("pointermove", (event) => this.moveItem(event, canvas));
    canvas.addEventListener("pointerup", (event) => this.endItemDrag(event, canvas));
    canvas.addEventListener("pointercancel", (event) => this.endItemDrag(event, canvas));
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.updateViewport(canvas));
    this.resizeObserver.observe(canvas);
    this.updateViewport(canvas);
  }

  disconnectedCallback(): void {
    this.resizeObserver?.disconnect();
  }

  private dropEntry(event: DragEvent, canvas: SVGSVGElement): void {
    if (!event.dataTransfer?.types.includes(PALETTE_ENTRY_MIME)) return;
    event.preventDefault();
    canvas.classList.remove("is-drop-target");

    let dataType: SavedDataType & { editorScale?: number };
    try {
      dataType = JSON.parse(event.dataTransfer.getData(PALETTE_ENTRY_MIME)) as SavedDataType;
    } catch {
      return;
    }
    if (!dataType || typeof dataType.name !== "string" || !Array.isArray(dataType.elements)) return;
    const icon = createDataTypeDiagram(dataType);
    const editorScale = typeof dataType.editorScale === "number" && Number.isFinite(dataType.editorScale) && dataType.editorScale > 0
      ? dataType.editorScale
      : 1;
    const screenHeight = 96 * editorScale;
    icon.dataset.screenHeight = String(screenHeight);
    this.setIconSize(icon, screenHeight);
    icon.classList.add("canvas-item");
    this.positionItem(icon, event, canvas, Number(icon.getAttribute("width")) / 2, Number(icon.getAttribute("height")) / 2);
    this.shadowRoot!.querySelector<SVGGElement>(".canvas-items")!.append(icon);
    this.shadowRoot!.querySelector(".canvas-hint")?.remove();
  }

  private startItemDrag(event: PointerEvent, canvas: SVGSVGElement): void {
    if (!(event.target instanceof Element)) return;
    const icon = event.target.closest<SVGSVGElement>(".canvas-item");
    if (!icon || event.button !== 0) return;
    const pointer = this.canvasPoint(event, canvas);
    const itemX = Number.parseFloat(icon.getAttribute("x") ?? "0");
    const itemY = Number.parseFloat(icon.getAttribute("y") ?? "0");
    this.activeItem = {
      icon,
      pointerId: event.pointerId,
      offsetX: pointer.x - itemX,
      offsetY: pointer.y - itemY,
    };
    icon.classList.add("is-dragging");
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  private moveItem(event: PointerEvent, canvas: SVGSVGElement): void {
    if (!this.activeItem || event.pointerId !== this.activeItem.pointerId) return;
    this.positionItem(this.activeItem.icon, event, canvas, this.activeItem.offsetX, this.activeItem.offsetY);
  }

  private endItemDrag(event: PointerEvent, canvas: SVGSVGElement): void {
    if (!this.activeItem || event.pointerId !== this.activeItem.pointerId) return;
    this.activeItem.icon.classList.remove("is-dragging");
    this.activeItem = undefined;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  private positionItem(
    icon: SVGSVGElement,
    event: MouseEvent,
    canvas: SVGSVGElement,
    offsetX = 80,
    offsetY = 48,
  ): void {
    const pointer = this.canvasPoint(event, canvas);
    icon.setAttribute("x", String(pointer.x - offsetX));
    icon.setAttribute("y", String(pointer.y - offsetY));
  }

  private setIconSize(icon: SVGSVGElement, screenHeight: number): void {
    const height = screenHeight / this.viewportScale;
    const viewBox = icon.viewBox.baseVal;
    icon.setAttribute("height", String(height));
    icon.setAttribute("width", String(height * (viewBox.width / viewBox.height)));
  }

  private canvasPoint(event: MouseEvent, canvas: SVGSVGElement): { x: number; y: number } {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: this.viewportX + ((event.clientX - bounds.left) / bounds.width) * this.viewportWidth,
      y: ((event.clientY - bounds.top) / bounds.height) * 440,
    };
  }

  private updateViewport(canvas: SVGSVGElement): void {
    const viewport = updateSvgViewport(canvas, { logicalHeight: 440, centerX: 400, centerY: 220 });
    if (!viewport) return;
    this.viewportWidth = viewport.width;
    this.viewportX = viewport.x;
    this.viewportScale = viewport.scale;
    canvas.querySelectorAll<SVGSVGElement>(".canvas-item").forEach((icon) => {
      const screenHeight = Number(icon.dataset.screenHeight);
      if (Number.isFinite(screenHeight)) this.setIconSize(icon, screenHeight);
    });
    canvas.querySelector(".canvas-border")?.setAttribute("x", String(this.viewportX + 1));
    canvas.querySelector(".canvas-border")?.setAttribute("width", String(this.viewportWidth - 2));
    const hint = canvas.querySelector(".canvas-hint");
    hint?.setAttribute("x", "400");
    hint?.setAttribute("font-size", String(16 / viewport.scale));
  }
}

customElements.define("algorithm-canvas", AlgorithmCanvas);
