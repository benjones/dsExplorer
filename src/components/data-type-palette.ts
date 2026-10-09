import "./data-type-palette-entry.js";

export class DataTypePalette extends HTMLElement {
  private readonly entries = ["Array", "Linked list", "Stack", "Queue", "Tree", "Graph"].map((title) => {
    const entry = document.createElement("data-type-palette-entry");
    entry.setAttribute("title", title);
    return entry;
  });

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
}

customElements.define("data-type-palette", DataTypePalette);
