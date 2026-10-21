import "./data-type-palette-entry.js";
import type { SavedDataType } from "./data-type-diagram.js";

const INITIAL_DATA_TYPES: SavedDataType[] = [
  { name: "Value", elements: [{ kind: "value", label: "" }] },
  { name: "Reference", elements: [{ kind: "reference", label: "" }] },
  { name: "Array", elements: [{ kind: "array", label: "" }] },
];

export class DataTypePalette extends HTMLElement {
  private readonly entries: HTMLElement[] = [];

  constructor() {
    super();
    this.entries.push(...INITIAL_DATA_TYPES.map((dataType) => this.createEntry(dataType)));
  }

  connectedCallback(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <link rel="stylesheet" href="${new URL("./data-type-palette.css", import.meta.url).href}" />
      <aside class="panel" aria-labelledby="palette-title">
        <h2 id="palette-title">Data types</h2>
      </aside>
    `;
    root.querySelector(".panel")!.append(...this.entries);
  }

  addDataType(dataType: SavedDataType, editorScale = 1): void {
    const entry = this.createEntry(dataType, editorScale);
    this.entries.push(entry);
    this.shadowRoot?.querySelector(".panel")?.append(entry);
  }

  private createEntry(dataType: SavedDataType, editorScale = 1): HTMLElement {
    const entry = document.createElement("data-type-palette-entry") as HTMLElement & { dataType: SavedDataType; editorScale: number };
    entry.dataType = dataType;
    entry.editorScale = editorScale;
    return entry;
  }
}

customElements.define("data-type-palette", DataTypePalette);
