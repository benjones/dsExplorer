import "./data-type-palette-entry.js";
import type { SavedDataType } from "./data-type-diagram.js";

export class DataTypePalette extends HTMLElement {
  private readonly entries: HTMLElement[] = [];

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

  addDataType(dataType: SavedDataType): void {
    const entry = document.createElement("data-type-palette-entry") as HTMLElement & { dataType: SavedDataType };
    entry.dataType = dataType;
    this.entries.push(entry);
    this.shadowRoot?.querySelector(".panel")?.append(entry);
  }
}

customElements.define("data-type-palette", DataTypePalette);
