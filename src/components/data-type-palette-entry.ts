import { createDataTypeDiagram, type SavedDataType } from "./data-type-diagram.js";

export const PALETTE_ENTRY_MIME = "application/x-ds-explorer-palette-entry";

export class DataTypePaletteEntry extends HTMLElement {
  private savedDataType: SavedDataType = { name: "Untitled data type", elements: [] };
  private savedEditorScale = 1;

  set dataType(value: SavedDataType) {
    this.savedDataType = value;
    if (this.isConnected) this.render();
  }

  set editorScale(value: number) {
    this.savedEditorScale = value;
  }

  connectedCallback(): void {
    this.render();
  }

  private render(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <link rel="stylesheet" href="${new URL("./data-type-palette-entry.css", import.meta.url).href}" />
      <button type="button">
        <span></span>
      </button>
    `;
    const button = root.querySelector("button")!;
    button.draggable = true;
    root.querySelector("span")!.textContent = this.savedDataType.name;
    button.append(createDataTypeDiagram(this.savedDataType, { showName: false }));
    button.addEventListener("dragstart", (event) => {
      if (!event.dataTransfer) return;
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData(PALETTE_ENTRY_MIME, JSON.stringify({ ...this.savedDataType, editorScale: this.savedEditorScale }));
      event.dataTransfer.setData("text/plain", this.savedDataType.name);
    });
  }
}

customElements.define("data-type-palette-entry", DataTypePaletteEntry);
