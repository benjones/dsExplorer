import "./algorithm-canvas.js";
import "./data-type-editor.js";
import "./data-type-palette.js";
import type { SavedDataType } from "./data-type-diagram.js";

class DsExplorer extends HTMLElement {
  private splitterPointerId?: number;

  connectedCallback(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <link rel="stylesheet" href="${new URL("./ds-explorer.css", import.meta.url).href}" />
      <section class="workspace" aria-label="DS Explorer workspace">
        <data-type-palette></data-type-palette>
        <algorithm-canvas></algorithm-canvas>
        <div class="horizontal-splitter" role="separator" aria-label="Resize data type editor" aria-orientation="horizontal" tabindex="0"></div>
        <data-type-editor></data-type-editor>
      </section>
    `;
    const workspace = root.querySelector<HTMLElement>(".workspace")!;
    const splitter = root.querySelector<HTMLElement>(".horizontal-splitter")!;
    const palette = root.querySelector<HTMLElement & { addDataType(dataType: SavedDataType, editorScale?: number): void }>("data-type-palette")!;
    root.querySelector("data-type-editor")!.addEventListener("save-data-type", (event) => {
      const { editorScale, ...dataType } = (event as CustomEvent<SavedDataType & { editorScale: number }>).detail;
      palette.addDataType(dataType, editorScale);
    });
    splitter.addEventListener("pointerdown", (event) => this.startResize(event, splitter));
    splitter.addEventListener("pointermove", (event) => this.resize(event, workspace));
    splitter.addEventListener("pointerup", (event) => this.endResize(event, splitter));
    splitter.addEventListener("pointercancel", (event) => this.endResize(event, splitter));
  }

  private startResize(event: PointerEvent, splitter: HTMLElement): void {
    if (event.button !== 0) return;
    this.splitterPointerId = event.pointerId;
    splitter.setPointerCapture(event.pointerId);
    splitter.classList.add("is-resizing");
    event.preventDefault();
  }

  private resize(event: PointerEvent, workspace: HTMLElement): void {
    if (event.pointerId !== this.splitterPointerId) return;
    const bounds = workspace.getBoundingClientRect();
    const minimumEditorHeight = 128;
    const minimumCanvasHeight = 192;
    const maximumEditorHeight = Math.max(minimumEditorHeight, bounds.height - minimumCanvasHeight - 8);
    const editorHeight = Math.min(maximumEditorHeight, Math.max(minimumEditorHeight, bounds.bottom - event.clientY));
    this.style.setProperty("--editor-height", `${editorHeight}px`);
  }

  private endResize(event: PointerEvent, splitter: HTMLElement): void {
    if (event.pointerId !== this.splitterPointerId) return;
    this.splitterPointerId = undefined;
    splitter.classList.remove("is-resizing");
    if (splitter.hasPointerCapture(event.pointerId)) splitter.releasePointerCapture(event.pointerId);
  }
}

customElements.define("ds-explorer", DsExplorer);
