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
    start: { x: number; y: number };
    hasMoved: boolean;
  };
  private activeValue?: { value: SVGGElement; pointerId: number; start: { x: number; y: number }; hasMoved: boolean };
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
          <span>Drag data types here · Click above an item to label it</span>
        </div>
        <svg class="canvas" viewBox="0 0 800 440" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Algorithm canvas">
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
    icon.setAttribute("role", "group");
    this.addItemLabel(icon);
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
    if (event.target instanceof HTMLInputElement || event.target.closest(".canvas-item-label")) return;
    const arrow = event.target.closest<SVGLineElement>(".reference-arrow");
    if (arrow) {
      this.resetReferenceArrow(arrow, canvas);
      event.preventDefault();
      return;
    }
    const value = event.target.closest<SVGGElement>(".data-type-block-value");
    if (value) {
      if (event.button !== 0 || value.querySelector(".canvas-value-editor")) return;
      const start = this.canvasPoint(event, canvas);
      this.activeValue = { value, pointerId: event.pointerId, start, hasMoved: false };
      canvas.setPointerCapture(event.pointerId);
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
      this.activeReference.hasMoved ||= this.hasMovedBeyondThreshold(this.activeReference.start, pointer);
      this.setArrowEndpoints(this.activeReference.arrow, source, pointer);
      this.updateFieldDropTarget(this.activeReference.reference, pointer, canvas);
      return;
    }
    if (this.activeValue && event.pointerId === this.activeValue.pointerId) {
      const pointer = this.canvasPoint(event, canvas);
      this.activeValue.hasMoved ||= this.hasMovedBeyondThreshold(this.activeValue.start, pointer);
      if (this.activeValue.hasMoved) {
        this.activeValue.value.classList.add("is-content-dragging");
        this.updateFieldDropTarget(this.activeValue.value, pointer, canvas);
      }
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
    if (this.activeValue && event.pointerId === this.activeValue.pointerId) {
      this.endValueDrag(event, canvas);
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

  private addItemLabel(icon: SVGSVGElement): void {
    const label = svgElement("foreignObject", {
      class: "canvas-item-label",
      x: "4",
      y: "-28",
      width: String(icon.viewBox.baseVal.width - 8),
      height: "24",
    });
    const button = document.createElement("button");
    button.type = "button";
    label.append(button);
    icon.append(label);
    let hideTimer: number | undefined;
    icon.addEventListener("pointerenter", () => {
      window.clearTimeout(hideTimer);
      icon.classList.add("is-label-visible");
    });
    icon.addEventListener("pointerleave", () => {
      window.clearTimeout(hideTimer);
      hideTimer = window.setTimeout(() => icon.classList.remove("is-label-visible"), 2000);
    });
    const update = () => {
      const text = icon.dataset.label ?? "";
      button.textContent = text || "Add label";
      button.classList.toggle("is-empty", !text);
      button.title = text ? `Edit label: ${text}` : "Add label";
      button.setAttribute("aria-label", text ? `Edit item label: ${text}` : `Label ${icon.dataset.dataTypeName} item`);
      icon.setAttribute("aria-label", text ? `${text}: ${icon.dataset.dataTypeName}` : icon.dataset.dataTypeName!);
    };
    button.addEventListener("click", () => {
      const input = document.createElement("input");
      input.type = "text";
      input.value = icon.dataset.label ?? "";
      input.setAttribute("aria-label", "Item label");
      input.placeholder = "Item label";
      let finished = false;
      const finish = (save: boolean) => {
        if (finished) return;
        finished = true;
        if (save) icon.dataset.label = input.value.trim();
        update();
        label.replaceChildren(button);
      };
      input.addEventListener("blur", () => finish(true));
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== "Escape") return;
        event.preventDefault();
        finish(event.key === "Enter");
        button.focus();
      });
      label.replaceChildren(input);
      input.focus();
      input.select();
    });
    update();
  }

  private startReferenceDrag(event: PointerEvent, canvas: SVGSVGElement, reference: SVGGElement): void {
    if (event.button !== 0) return;
    const source = this.referencePoint(reference);
    const previousTarget = this.referenceTarget(reference, canvas);
    const arrow = this.createReferenceArrow(reference, canvas);
    arrow.classList.add("is-ghost");
    this.setArrowEndpoints(arrow, source, source);
    this.setReferenceValue(reference, "");
    this.activeReference = { reference, pointerId: event.pointerId, arrow, previousTarget, start: this.canvasPoint(event, canvas), hasMoved: false };
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  private endReferenceDrag(event: PointerEvent, canvas: SVGSVGElement): void {
    const activeReference = this.activeReference!;
    const point = this.canvasPoint(event, canvas);
    const targetReference = this.fieldAtCanvasPoint(point, canvas, "reference");
    const target = this.itemAtCanvasPoint(point, canvas);
    const sourceItem = activeReference.reference.closest<SVGSVGElement>(".canvas-item");
    this.clearFieldDropTargets(canvas);
    if (!activeReference.hasMoved) {
      this.restoreReference(activeReference, canvas);
    } else if (targetReference && targetReference !== activeReference.reference) {
      this.copyReference(activeReference, targetReference, canvas);
    } else if (targetReference === activeReference.reference) {
      this.restoreReference(activeReference, canvas);
    } else if (target && target !== sourceItem) {
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

  private endValueDrag(event: PointerEvent, canvas: SVGSVGElement): void {
    const activeValue = this.activeValue!;
    const target = activeValue.hasMoved ? this.fieldAtCanvasPoint(this.canvasPoint(event, canvas), canvas, "value") : undefined;
    activeValue.value.classList.remove("is-content-dragging");
    this.clearFieldDropTargets(canvas);
    if (target && target !== activeValue.value) {
      this.setCanvasValue(target, activeValue.value.dataset.value ?? "");
    } else if (!activeValue.hasMoved) {
      this.startValueEdit(activeValue.value);
    }
    this.activeValue = undefined;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  private restoreReference(activeReference: NonNullable<AlgorithmCanvas["activeReference"]>, canvas: SVGSVGElement): void {
    if (activeReference.previousTarget) {
      const target = this.targetForId(activeReference.previousTarget.id, canvas);
      if (target) {
        activeReference.arrow.classList.remove("is-ghost");
        activeReference.arrow.dataset.targetItemId = target.dataset.itemId;
        this.setArrowEndpoints(activeReference.arrow, this.referencePoint(activeReference.reference), this.itemConnectionPoint(target, this.referencePoint(activeReference.reference)));
        return;
      }
    }
    activeReference.arrow.remove();
    this.setReferenceValue(activeReference.reference, "null");
  }

  private copyReference(activeReference: NonNullable<AlgorithmCanvas["activeReference"]>, destination: SVGGElement, canvas: SVGSVGElement): void {
    this.restoreReference(activeReference, canvas);
    const previousTarget = this.referenceTarget(destination, canvas);
    const target = activeReference.previousTarget ? this.targetForId(activeReference.previousTarget.id, canvas) : undefined;
    if (target) {
      const arrow = this.createReferenceArrow(destination, canvas);
      arrow.dataset.targetItemId = target.dataset.itemId;
      this.setReferenceValue(destination, "");
      const source = this.referencePoint(destination);
      this.setArrowEndpoints(arrow, source, this.itemConnectionPoint(target, source));
      this.recordReferenceUpdate(previousTarget, this.itemTarget(target));
    } else {
      this.createReferenceArrow(destination, canvas).remove();
      this.setReferenceValue(destination, "null");
      this.recordReferenceUpdate(previousTarget, null);
    }
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
    return { id: item.dataset.itemId!, name: item.dataset.label || item.dataset.dataTypeName || "data type" };
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

  private fieldAtCanvasPoint(
    point: { x: number; y: number },
    canvas: SVGSVGElement,
    kind: "value" | "reference",
  ): SVGGElement | undefined {
    const items = [...canvas.querySelectorAll<SVGSVGElement>(".canvas-item")].reverse();
    for (const item of items) {
      const itemScale = Number(item.getAttribute("width")) / item.viewBox.baseVal.width;
      const itemX = Number(item.getAttribute("x"));
      const itemY = Number(item.getAttribute("y"));
      const fields = [...item.querySelectorAll<SVGGElement>(`.data-type-block-${kind}`)].reverse();
      for (const field of fields) {
        const transform = field.getAttribute("transform") ?? "";
        const match = /translate\(([^ ]+) ([^)]+)\)/.exec(transform);
        if (!match) continue;
        const scale = Number(field.dataset.scale) || 1;
        const centerX = itemX + Number(match[1]) * itemScale;
        const centerY = itemY + Number(match[2]) * itemScale;
        const width = (kind === "value" ? 56 : 76) * scale * itemScale;
        const height = 44 * scale * itemScale;
        if (Math.abs(point.x - centerX) <= width / 2 && Math.abs(point.y - centerY) <= height / 2) return field;
      }
    }
    return undefined;
  }

  private updateFieldDropTarget(source: SVGGElement, point: { x: number; y: number }, canvas: SVGSVGElement): void {
    const kind = source.classList.contains("data-type-block-value") ? "value" : "reference";
    const target = this.fieldAtCanvasPoint(point, canvas, kind);
    this.clearFieldDropTargets(canvas);
    if (target && target !== source) target.classList.add("is-content-drop-target");
  }

  private clearFieldDropTargets(canvas: SVGSVGElement): void {
    canvas.querySelectorAll<SVGGElement>(".is-content-drop-target").forEach((field) => field.classList.remove("is-content-drop-target"));
  }

  private hasMovedBeyondThreshold(start: { x: number; y: number }, end: { x: number; y: number }): boolean {
    return Math.hypot(end.x - start.x, end.y - start.y) > 4;
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
