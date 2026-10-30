import { PALETTE_ENTRY_MIME } from "./data-type-palette-entry.js";
import { createDataTypeDiagram, type SavedDataType } from "./data-type-diagram.js";
import { svgElement, updateSvgViewport } from "./svg-tools.js";

export class AlgorithmCanvas extends HTMLElement {
  private activeItem?: { icon: SVGSVGElement; pointerId: number; offsetX: number; offsetY: number };
  private activeReference?: {
    reference: SVGGElement;
    pointerId: number;
    arrow: SVGLineElement;
    previousTarget: { id: string; name: string } | null;
  };
  private resizeObserver?: ResizeObserver;
  private viewportX = 0;
  private viewportWidth = 800;
  private viewportScale = 1;
  private nextItemId = 0;

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
          <defs>
            <marker id="reference-arrowhead" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L8 4L0 8z" fill="var(--color-drop-border)"></path></marker>
          </defs>
          <rect x="1" y="1" width="798" height="438" rx="10" class="canvas-border"></rect>
          <text class="canvas-hint" x="400" y="220" text-anchor="middle">Drag a data type here</text>
          <g class="canvas-items"></g>
          <g class="canvas-arrows"></g>
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
    icon.dataset.itemId = String(this.nextItemId++);
    icon.dataset.dataTypeName = dataType.name;
    this.setIconSize(icon, screenHeight);
    icon.querySelectorAll<SVGGElement>(".data-type-block-reference").forEach((reference) => {
      reference.dataset.referenceId = `${icon.dataset.itemId}:${reference.dataset.fieldIndex}`;
      this.setReferenceValue(reference, "null");
    });
    icon.classList.add("canvas-item");
    this.positionItem(icon, event, canvas, Number(icon.getAttribute("width")) / 2, Number(icon.getAttribute("height")) / 2);
    this.shadowRoot!.querySelector<SVGGElement>(".canvas-items")!.append(icon);
    this.shadowRoot!.querySelector(".canvas-hint")?.remove();
  }

  private startItemDrag(event: PointerEvent, canvas: SVGSVGElement): void {
    if (!(event.target instanceof Element)) return;
    if (event.target instanceof HTMLInputElement) return;
    const arrow = event.target.closest<SVGLineElement>(".reference-arrow");
    if (arrow) {
      this.resetReferenceArrow(arrow, canvas);
      event.preventDefault();
      return;
    }
    const value = event.target.closest<SVGGElement>(".data-type-block-value");
    if (value) {
      if (!value.querySelector(".canvas-value-editor")) this.startValueEdit(value);
      event.preventDefault();
      return;
    }
    const reference = event.target.closest<SVGGElement>(".data-type-block-reference");
    if (reference) {
      this.startReferenceDrag(event, canvas, reference);
      return;
    }
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
    if (this.activeReference && event.pointerId === this.activeReference.pointerId) {
      const pointer = this.canvasPoint(event, canvas);
      const source = this.referencePoint(this.activeReference.reference);
      this.setArrowEndpoints(this.activeReference.arrow, source, pointer);
      return;
    }
    if (!this.activeItem || event.pointerId !== this.activeItem.pointerId) return;
    this.positionItem(this.activeItem.icon, event, canvas, this.activeItem.offsetX, this.activeItem.offsetY);
    this.updateArrows(canvas);
  }

  private endItemDrag(event: PointerEvent, canvas: SVGSVGElement): void {
    if (this.activeReference && event.pointerId === this.activeReference.pointerId) {
      this.endReferenceDrag(event, canvas);
      return;
    }
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

  private startReferenceDrag(event: PointerEvent, canvas: SVGSVGElement, reference: SVGGElement): void {
    if (event.button !== 0) return;
    const source = this.referencePoint(reference);
    const previousTarget = this.referenceTarget(reference, canvas);
    const arrow = this.createReferenceArrow(reference, canvas);
    arrow.classList.add("is-ghost");
    this.setArrowEndpoints(arrow, source, source);
    this.setReferenceValue(reference, "");
    this.activeReference = { reference, pointerId: event.pointerId, arrow, previousTarget };
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  private endReferenceDrag(event: PointerEvent, canvas: SVGSVGElement): void {
    const activeReference = this.activeReference!;
    const target = this.itemAtCanvasPoint(this.canvasPoint(event, canvas), canvas);
    const sourceItem = activeReference.reference.closest<SVGSVGElement>(".canvas-item");
    if (target && target !== sourceItem) {
      activeReference.arrow.classList.remove("is-ghost");
      activeReference.arrow.dataset.targetItemId = target.dataset.itemId;
      this.setArrowEndpoints(activeReference.arrow, this.referencePoint(activeReference.reference), this.itemConnectionPoint(target, this.referencePoint(activeReference.reference)));
      this.recordReferenceUpdate(activeReference.previousTarget, this.itemTarget(target));
    } else {
      activeReference.arrow.remove();
      this.setReferenceValue(activeReference.reference, "null");
      this.recordReferenceUpdate(activeReference.previousTarget, null);
    }
    this.activeReference = undefined;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  private createReferenceArrow(reference: SVGGElement, canvas: SVGSVGElement): SVGLineElement {
    const referenceId = reference.dataset.referenceId!;
    canvas.querySelectorAll<SVGLineElement>(".reference-arrow").forEach((arrow) => {
      if (arrow.dataset.referenceId === referenceId) arrow.remove();
    });
    const arrow = svgElement("line", {
      class: "reference-arrow",
      "data-reference-id": referenceId,
      "marker-end": "url(#reference-arrowhead)",
      stroke: "var(--color-drop-border)",
      "stroke-width": "2",
    }) as SVGLineElement;
    canvas.querySelector<SVGGElement>(".canvas-arrows")!.append(arrow);
    return arrow;
  }

  private setArrowEndpoints(arrow: SVGLineElement, source: { x: number; y: number }, target: { x: number; y: number }): void {
    arrow.setAttribute("x1", String(source.x));
    arrow.setAttribute("y1", String(source.y));
    arrow.setAttribute("x2", String(target.x));
    arrow.setAttribute("y2", String(target.y));
  }

  private referencePoint(reference: SVGGElement): { x: number; y: number } {
    const item = reference.closest<SVGSVGElement>(".canvas-item")!;
    const transform = reference.getAttribute("transform")!;
    const [, localX, localY] = /translate\(([^ ]+) ([^)]+)\)/.exec(transform)!;
    const scale = Number(item.getAttribute("width")) / item.viewBox.baseVal.width;
    return {
      x: Number(item.getAttribute("x")) + Number(localX) * scale,
      y: Number(item.getAttribute("y")) + Number(localY) * scale,
    };
  }

  private itemCenter(item: SVGSVGElement): { x: number; y: number } {
    return {
      x: Number(item.getAttribute("x")) + Number(item.getAttribute("width")) / 2,
      y: Number(item.getAttribute("y")) + Number(item.getAttribute("height")) / 2,
    };
  }

  private itemConnectionPoint(item: SVGSVGElement, source: { x: number; y: number }): { x: number; y: number } {
    const center = this.itemCenter(item);
    const halfWidth = Number(item.getAttribute("width")) / 2;
    const halfHeight = Number(item.getAttribute("height")) / 2;
    const deltaX = source.x - center.x;
    const deltaY = source.y - center.y;
    const distance = Math.max(Math.abs(deltaX) / halfWidth, Math.abs(deltaY) / halfHeight, 1);
    return { x: center.x + deltaX / distance, y: center.y + deltaY / distance };
  }

  private setReferenceValue(reference: SVGGElement, value: string): void {
    reference.querySelector(".reference-value")?.remove();
    if (!value) return;
    const scale = Number(reference.dataset.scale);
    const text = svgElement("text", {
      class: "reference-value",
      x: "0",
      y: String(5 * scale),
      "text-anchor": "middle",
      fill: "var(--color-text)",
      "font-size": String(12 * scale),
    });
    text.textContent = value;
    reference.append(text);
  }

  private startValueEdit(valueBlock: SVGGElement): void {
    const scale = Number(valueBlock.dataset.scale);
    const editor = svgElement("foreignObject", {
      class: "canvas-value-editor",
      x: String(-26 * scale),
      y: String(-16 * scale),
      width: String(52 * scale),
      height: String(32 * scale),
    }) as SVGForeignObjectElement;
    const input = document.createElement("input");
    input.type = "text";
    input.value = valueBlock.dataset.value ?? "";
    input.setAttribute("aria-label", "Value");
    editor.append(input);
    valueBlock.querySelector(".value-display")?.setAttribute("visibility", "hidden");
    valueBlock.append(editor);
    input.addEventListener("blur", () => this.setCanvasValue(valueBlock, input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") input.blur();
      if (event.key === "Escape") this.setCanvasValue(valueBlock, valueBlock.dataset.value ?? "");
    });
    requestAnimationFrame(() => input.focus());
  }

  private setCanvasValue(valueBlock: SVGGElement, value: string): void {
    const previousValue = valueBlock.dataset.value;
    valueBlock.querySelector(".canvas-value-editor")?.remove();
    const display = valueBlock.querySelector<SVGTextElement>(".value-display")!;
    const valueType = this.valueType(value);
    valueBlock.dataset.value = value;
    valueBlock.dataset.valueType = valueType;
    display.setAttribute("visibility", "visible");
    display.textContent = value || '""';
    valueBlock.querySelector("rect")?.setAttribute("fill", `var(--color-value-${valueType})`);
    if (previousValue !== value) {
      this.dispatchEvent(new CustomEvent("value-updated", {
        bubbles: true,
        composed: true,
        detail: { previousValue, value, valueType },
      }));
    }
  }

  private valueType(value: string): "string" | "number" | "boolean" {
    if (value === "true" || value === "false") return "boolean";
    if (value.trim() !== "" && Number.isFinite(Number(value))) return "number";
    return "string";
  }

  private updateArrows(canvas: SVGSVGElement): void {
    canvas.querySelectorAll<SVGLineElement>(".reference-arrow:not(.is-ghost)").forEach((arrow) => {
      const reference = canvas.querySelector<SVGGElement>(`[data-reference-id="${arrow.dataset.referenceId}"]`);
      const target = canvas.querySelector<SVGSVGElement>(`[data-item-id="${arrow.dataset.targetItemId}"]`);
      if (reference && target) {
        const source = this.referencePoint(reference);
        this.setArrowEndpoints(arrow, source, this.itemConnectionPoint(target, source));
      }
    });
  }

  private resetReferenceArrow(arrow: SVGLineElement, canvas: SVGSVGElement): void {
    const reference = canvas.querySelector<SVGGElement>(`[data-reference-id="${arrow.dataset.referenceId}"]`);
    const target = this.targetForId(arrow.dataset.targetItemId, canvas);
    arrow.remove();
    if (reference) this.setReferenceValue(reference, "null");
    this.recordReferenceUpdate(target ? this.itemTarget(target) : null, null);
  }

  private referenceTarget(reference: SVGGElement, canvas: SVGSVGElement): { id: string; name: string } | null {
    const arrow = [...canvas.querySelectorAll<SVGLineElement>(".reference-arrow")].find((candidate) => candidate.dataset.referenceId === reference.dataset.referenceId);
    const target = this.targetForId(arrow?.dataset.targetItemId, canvas);
    return target ? this.itemTarget(target) : null;
  }

  private targetForId(itemId: string | undefined, canvas: SVGSVGElement): SVGSVGElement | undefined {
    return [...canvas.querySelectorAll<SVGSVGElement>(".canvas-item")].find((item) => item.dataset.itemId === itemId);
  }

  private itemTarget(item: SVGSVGElement): { id: string; name: string } {
    return { id: item.dataset.itemId!, name: item.dataset.dataTypeName ?? "data type" };
  }

  private recordReferenceUpdate(previousTarget: { id: string; name: string } | null, target: { id: string; name: string } | null): void {
    if (previousTarget?.id === target?.id) return;
    this.dispatchEvent(new CustomEvent("reference-updated", {
      bubbles: true,
      composed: true,
      detail: { previousTarget: previousTarget?.name ?? null, target: target?.name ?? null },
    }));
  }

  private itemAtCanvasPoint(point: { x: number; y: number }, canvas: SVGSVGElement): SVGSVGElement | undefined {
    const items = [...canvas.querySelectorAll<SVGSVGElement>(".canvas-item")];
    return items.reverse().find((item) => {
      const x = Number(item.getAttribute("x"));
      const y = Number(item.getAttribute("y"));
      const width = Number(item.getAttribute("width"));
      const height = Number(item.getAttribute("height"));
      return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
    });
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
    this.updateArrows(canvas);
    canvas.querySelector(".canvas-border")?.setAttribute("x", String(this.viewportX + 1));
    canvas.querySelector(".canvas-border")?.setAttribute("width", String(this.viewportWidth - 2));
    const hint = canvas.querySelector(".canvas-hint");
    hint?.setAttribute("x", "400");
    hint?.setAttribute("font-size", String(16 / viewport.scale));
  }
}

customElements.define("algorithm-canvas", AlgorithmCanvas);
