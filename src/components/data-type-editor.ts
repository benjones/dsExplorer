import { updateSvgViewport } from "./svg-viewport.js";
import type { DataTypeElement } from "./data-type-diagram.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const BLOCK_MIME = "application/x-ds-explorer-type-editor-block";
const CANVAS_HEIGHT = 240;
const ARRAY_Y = 120;
const ARRAY_PADDING = 24;
const BLOCK_GAP = 16;
const EMPTY_PLACEHOLDER_WIDTH = 200;

type BlockKind = DataTypeElement;

function isBlockKind(value: string): value is BlockKind {
  return value === "value" || value === "array" || value === "reference";
}

function svgElement(name: string, attributes: Record<string, string>): SVGElement {
  const element = document.createElementNS(SVG_NAMESPACE, name);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

export class DataTypeEditor extends HTMLElement {
  private readonly elements: BlockKind[] = [];
  private dropIndex?: number;
  private previewKind?: BlockKind;
  private reorder?: { pointerId: number; sourceIndex: number; targetIndex: number; pointerX: number; pointerY: number };
  private activeReorderCanvas?: SVGSVGElement;
  private resizeObserver?: ResizeObserver;
  private viewportY = 0;
  private viewportWidth = 800;
  private viewportHeight = CANVAS_HEIGHT;
  private arrayWidth = 620;
  private emptyArrayWidth = EMPTY_PLACEHOLDER_WIDTH;

  connectedCallback(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <link rel="stylesheet" href="${new URL("./data-type-editor.css", import.meta.url).href}" />
      <section class="panel" aria-labelledby="editor-title">
        <div class="heading">
          <h2 id="editor-title">Data type editor</h2>
        </div>
        <div class="editor-layout">
          <svg class="editor-canvas" viewBox="0 0 800 240" preserveAspectRatio="xMidYMid meet" role="application" aria-label="Data type editor array">
            <rect class="canvas-border" x="1" y="1" width="798" height="238" rx="8"></rect>
            <rect class="array-container" x="90" y="72" width="620" height="96" rx="10"></rect>
            <text class="array-placeholder" x="400" y="126" text-anchor="middle">Drop elements here</text>
            <g class="editor-blocks"></g>
            <foreignObject class="array-name-editor" x="102" y="78" width="596" height="18">
              <input id="data-type-name" xmlns="http://www.w3.org/1999/xhtml" type="text" aria-label="Data type name" placeholder="Data type name" />
            </foreignObject>
          </svg>
          <aside class="block-palette" aria-label="Type editor building blocks">
            <h3>Blocks</h3>
            <div class="block-options">
              <div class="palette-entry" data-block="value"><button class="palette-drag-source" type="button" aria-label="Drag Value block"></button><span>Value</span></div>
              <div class="palette-entry" data-block="array"><button class="palette-drag-source" type="button" aria-label="Drag Array block"></button><span>Array</span></div>
              <div class="palette-entry" data-block="reference"><button class="palette-drag-source" type="button" aria-label="Drag Reference block"></button><span>Reference</span></div>
            </div>
            <button class="add-to-palette" type="button">Add to palette</button>
          </aside>
        </div>
      </section>
    `;

    const canvas = root.querySelector<SVGSVGElement>(".editor-canvas")!;
    const saveButton = root.querySelector<HTMLButtonElement>(".add-to-palette")!;
    const nameInput = root.querySelector<HTMLInputElement>("#data-type-name")!;
    saveButton.addEventListener("click", () => {
      const name = nameInput.value.trim();
      if (!name) {
        nameInput.focus();
        return;
      }
      this.dispatchEvent(new CustomEvent("save-data-type", {
        bubbles: true,
        composed: true,
        detail: { name, elements: [...this.elements] },
      }));
      nameInput.value = "";
      nameInput.focus();
    });
    root.querySelectorAll<HTMLElement>("[data-block]").forEach((entry) => {
      const kind = entry.dataset.block!;
      if (!isBlockKind(kind)) return;
      const source = entry.querySelector<HTMLButtonElement>(".palette-drag-source")!;
      const preview = svgElement("svg", { class: "palette-preview", viewBox: "0 0 192 52", "aria-hidden": "true" }) as SVGSVGElement;
      preview.append(this.createBlock(kind, 96, -1, 26));
      source.append(preview);
      source.draggable = true;
      source.addEventListener("dragstart", (event) => {
        if (!event.dataTransfer) return;
        const dragImage = preview.cloneNode(true) as SVGSVGElement;
        dragImage.classList.add("palette-drag-image");
        root.append(dragImage);
        event.dataTransfer.setDragImage(dragImage, 96, 26);
        requestAnimationFrame(() => dragImage.remove());
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData(BLOCK_MIME, kind);
        event.dataTransfer.setData("text/plain", kind);
      });
    });
    canvas.addEventListener("dragover", (event) => this.previewDrop(event, canvas));
    canvas.addEventListener("dragleave", (event) => this.clearPreview(event, canvas));
    canvas.addEventListener("drop", (event) => this.dropBlock(event, canvas));
    canvas.addEventListener("pointerdown", (event) => this.startReorder(event, canvas));
    canvas.addEventListener("pointermove", (event) => this.moveReorder(event, canvas));
    canvas.addEventListener("pointerup", (event) => this.endReorder(event, canvas));
    canvas.addEventListener("pointercancel", (event) => this.endReorder(event, canvas));
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.updateViewport(canvas));
    this.resizeObserver.observe(canvas);
    this.updateViewport(canvas);
  }

  disconnectedCallback(): void {
    this.resizeObserver?.disconnect();
    window.removeEventListener("pointerup", this.finishReorder, true);
    window.removeEventListener("pointercancel", this.finishReorder, true);
  }

  private previewDrop(event: DragEvent, canvas: SVGSVGElement): void {
    if (!event.dataTransfer?.types.includes(BLOCK_MIME)) return;
    const kind = event.dataTransfer.getData(BLOCK_MIME);
    if (!isBlockKind(kind)) return;
    const index = this.insertionIndex(event, canvas);
    if (index === undefined) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    canvas.classList.add("is-drop-target");
    if (this.dropIndex === index && this.previewKind === kind) return;
    this.dropIndex = index;
    this.previewKind = kind;
    this.updateViewport(canvas);
  }

  private clearPreview(event: DragEvent, canvas: SVGSVGElement): void {
    if (event.relatedTarget instanceof Node && canvas.contains(event.relatedTarget)) return;
    canvas.classList.remove("is-drop-target");
    if (this.dropIndex === undefined) return;
    this.dropIndex = undefined;
    this.previewKind = undefined;
    this.updateViewport(canvas);
  }

  private dropBlock(event: DragEvent, canvas: SVGSVGElement): void {
    const kind = event.dataTransfer?.getData(BLOCK_MIME) ?? "";
    const index = this.insertionIndex(event, canvas);
    if (!isBlockKind(kind) || index === undefined) return;
    event.preventDefault();
    this.elements.splice(index, 0, kind);
    this.dropIndex = undefined;
    this.previewKind = undefined;
    canvas.classList.remove("is-drop-target");
    this.updateViewport(canvas);
  }

  private insertionIndex(event: MouseEvent, canvas: SVGSVGElement): number | undefined {
    const point = this.canvasPoint(event, canvas);
    const left = this.arrayLeft + 24;
    const right = this.arrayLeft + this.arrayWidth - 24;
    if (point.x < left || point.x > right || point.y < 72 || point.y > 168) return undefined;
    return Math.max(0, Math.min(this.elements.length, Math.round(((point.x - left) / (right - left)) * this.elements.length)));
  }

  private renderElements(canvas: SVGSVGElement): void {
    const group = canvas.querySelector<SVGGElement>(".editor-blocks")!;
    this.updateArrayGeometry();
    const container = canvas.querySelector(".array-container");
    container?.setAttribute("x", String(this.arrayLeft));
    container?.setAttribute("width", String(this.arrayWidth));
    const slots = this.previewSlots();
    const positions = this.slotPositions(slots);
    const nodes: SVGElement[] = [];

    if (this.reorder) {
      const { sourceIndex } = this.reorder;
      const layout = this.reorderLayout();
      const ghost = this.createBlock(this.elements[sourceIndex], positions[layout.ghostIndex], sourceIndex);
      const preview = this.createBlock(this.elements[sourceIndex], this.reorder.pointerX, -1, this.reorder.pointerY);
      ghost.classList.add("is-ghost");
      preview.classList.add("is-drag-preview");
      nodes.push(this.insertionMarker(positions[layout.gapIndex]));
      this.elements.forEach((kind, index) => {
        if (index === sourceIndex) return;
        const slot = index + (index >= layout.gapIndex ? 1 : 0);
        nodes.push(this.createBlock(kind, positions[slot], index));
      });
      nodes.push(preview);
      nodes.push(ghost);
    } else if (this.dropIndex !== undefined) {
      const markerX = positions[this.dropIndex];
      nodes.push(this.insertionMarker(markerX));
      this.elements.forEach((kind, index) => {
        const slot = index >= this.dropIndex! ? index + 1 : index;
        nodes.push(this.createBlock(kind, positions[slot], index));
      });
    } else {
      this.elements.forEach((kind, index) => nodes.push(this.createBlock(kind, positions[index], index)));
    }
    group.replaceChildren(...nodes);
    canvas.querySelector(".array-placeholder")?.setAttribute("visibility", this.elements.length === 0 ? "visible" : "hidden");
  }

  private insertionMarker(x: number): SVGElement {
    return svgElement("line", { class: "insertion-marker", x1: String(x), x2: String(x), y1: "86", y2: "154" });
  }

  private previewSlots(): BlockKind[] {
    if (this.reorder) return this.reorderLayout().kinds;
    const slots = [...this.elements];
    if (this.dropIndex !== undefined && this.previewKind) slots.splice(this.dropIndex, 0, this.previewKind);
    return slots;
  }

  private reorderLayout(): { kinds: BlockKind[]; gapIndex: number; ghostIndex: number } {
    const { sourceIndex, targetIndex } = this.reorder!;
    const gapIndex = targetIndex > sourceIndex ? targetIndex + 1 : targetIndex;
    const kinds = [...this.elements];
    kinds.splice(gapIndex, 0, this.elements[sourceIndex]);
    return {
      kinds,
      gapIndex,
      ghostIndex: sourceIndex + (gapIndex <= sourceIndex ? 1 : 0),
    };
  }

  private slotPositions(kinds: BlockKind[]): number[] {
    let cursor = this.arrayLeft + ARRAY_PADDING;
    return kinds.map((kind) => {
      const width = this.blockWidth(kind);
      const x = cursor + width / 2;
      cursor += width + BLOCK_GAP;
      return x;
    });
  }

  private updateArrayGeometry(): void {
    if (this.elements.length === 0) {
      this.arrayWidth = Math.max(112, this.emptyArrayWidth);
      return;
    }
    const visibleKinds = this.previewSlots();
    const contentWidth = visibleKinds.reduce((total, kind) => total + this.blockWidth(kind), 0);
    this.arrayWidth = Math.max(112, contentWidth + Math.max(0, visibleKinds.length - 1) * BLOCK_GAP + ARRAY_PADDING * 2);
  }

  private blockWidth(kind: BlockKind): number {
    if (kind === "array") return 152;
    if (kind === "reference") return 76;
    return 56;
  }

  private createBlock(kind: BlockKind, x: number, index: number, y = ARRAY_Y): SVGElement {
    const block = svgElement("g", {
      class: `editor-block editor-block-${kind}`,
      transform: `translate(${x} ${y})`,
      "data-index": String(index),
    });
    if (kind === "value") {
      block.append(
        svgElement("rect", { x: "-28", y: "-22", width: "56", height: "44", rx: "5" }),
        svgElement("text", { x: "0", y: "8", "text-anchor": "middle" }),
      );
      block.querySelector("text")!.textContent = "?";
    } else if (kind === "array") {
      block.append(svgElement("rect", { x: "-76", y: "-22", width: "152", height: "44", rx: "5" }));
      [-51.5, -32.5, -13.5, 5.5, 27.5, 51.5].forEach((x) => {
        block.append(svgElement("line", { class: "array-divider", x1: String(x), x2: String(x), y1: "-22", y2: "22" }));
      });
      ["1", "2", "…", "3", "…", "n−1", "n"].forEach((label, index) => {
        const positions = [-61, -42, -23, -4, 15, 40, 63];
        const text = svgElement("text", { x: String(positions[index]), y: "5", "text-anchor": "middle" });
        text.textContent = label;
        block.append(text);
      });
    } else {
      block.append(svgElement("rect", { x: "-38", y: "-22", width: "76", height: "44", rx: "5" }));
    }
    return block;
  }

  private startReorder(event: PointerEvent, canvas: SVGSVGElement): void {
    if (!(event.target instanceof Element) || event.button !== 0) return;
    const block = event.target.closest<SVGGElement>(".editor-block");
    const index = Number(block?.dataset.index);
    if (!block || !Number.isInteger(index)) return;
    const pointer = this.canvasPoint(event, canvas);
    this.reorder = {
      pointerId: event.pointerId,
      sourceIndex: index,
      targetIndex: index,
      pointerX: pointer.x,
      pointerY: pointer.y,
    };
    canvas.classList.add("is-reordering");
    canvas.setPointerCapture(event.pointerId);
    this.activeReorderCanvas = canvas;
    window.addEventListener("pointerup", this.finishReorder, true);
    window.addEventListener("pointercancel", this.finishReorder, true);
    this.updateViewport(canvas);
    event.preventDefault();
  }

  private moveReorder(event: PointerEvent, canvas: SVGSVGElement): void {
    if (!this.reorder || event.pointerId !== this.reorder.pointerId) return;
    const pointer = this.canvasPoint(event, canvas);
    this.reorder.pointerX = pointer.x;
    this.reorder.pointerY = pointer.y;
    const insertion = this.insertionIndex(event, canvas);
    if (insertion !== undefined) {
      this.reorder.targetIndex = Math.max(0, Math.min(this.elements.length - 1, insertion > this.reorder.sourceIndex ? insertion - 1 : insertion));
    }
    this.updateViewport(canvas);
  }

  private endReorder(event: PointerEvent, canvas: SVGSVGElement): void {
    if (!this.reorder || event.pointerId !== this.reorder.pointerId) return;
    if (this.isInsideArray(event, canvas)) {
      const [kind] = this.elements.splice(this.reorder.sourceIndex, 1);
      this.elements.splice(this.reorder.targetIndex, 0, kind);
    } else {
      this.elements.splice(this.reorder.sourceIndex, 1);
    }
    this.reorder = undefined;
    this.activeReorderCanvas = undefined;
    canvas.classList.remove("is-reordering");
    window.removeEventListener("pointerup", this.finishReorder, true);
    window.removeEventListener("pointercancel", this.finishReorder, true);
    this.updateViewport(canvas);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  private isInsideArray(event: MouseEvent, canvas: SVGSVGElement): boolean {
    return this.insertionIndex(event, canvas) !== undefined;
  }

  private readonly finishReorder = (event: PointerEvent): void => {
    if (this.activeReorderCanvas) this.endReorder(event, this.activeReorderCanvas);
  };

  private get arrayLeft(): number {
    return this.centerX - this.arrayWidth / 2;
  }

  private get centerX(): number {
    return this.viewportWidth / 2;
  }

  private canvasPoint(event: MouseEvent, canvas: SVGSVGElement): { x: number; y: number } {
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * this.viewportWidth,
      y: this.viewportY + ((event.clientY - bounds.top) / bounds.height) * this.viewportHeight,
    };
  }

  private updateViewport(canvas: SVGSVGElement): void {
    this.updateArrayGeometry();
    const requiredWidth = this.arrayWidth + 40;
    const viewport = updateSvgViewport(canvas, {
      logicalHeight: CANVAS_HEIGHT,
      minimumWidth: requiredWidth,
      centerY: ARRAY_Y,
    });
    if (!viewport) return;
    this.viewportWidth = viewport.width;
    this.viewportHeight = viewport.height;
    this.viewportY = viewport.y;
    this.emptyArrayWidth = EMPTY_PLACEHOLDER_WIDTH / viewport.scale;
    canvas.querySelector(".canvas-border")?.setAttribute("x", "1");
    canvas.querySelector(".canvas-border")?.setAttribute("width", String(this.viewportWidth - 2));
    canvas.querySelector(".canvas-border")?.setAttribute("y", String(this.viewportY + 1));
    canvas.querySelector(".canvas-border")?.setAttribute("height", String(this.viewportHeight - 2));
    canvas.querySelector(".array-container")?.setAttribute("x", String(this.arrayLeft));
    canvas.querySelector(".array-container")?.setAttribute("width", String(this.arrayWidth));
    const nameEditor = canvas.querySelector(".array-name-editor");
    nameEditor?.setAttribute("x", String(this.arrayLeft + 12));
    nameEditor?.setAttribute("width", String(Math.max(0, this.arrayWidth - 24)));
    const placeholder = canvas.querySelector(".array-placeholder");
    placeholder?.setAttribute("x", String(this.centerX));
    placeholder?.setAttribute("font-size", String(16 / viewport.scale));
    this.renderElements(canvas);
  }
}

customElements.define("data-type-editor", DataTypeEditor);
