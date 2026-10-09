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
      <style>
        :host, *, *::before, *::after { box-sizing: border-box; }
        :host { display: block; }
        .panel { display: flex; flex-direction: column; height: 100%; gap: 0.5rem; padding: 1rem; background: var(--color-panel); }
        h2 { margin: 0; font-size: 1rem; }
        @media (max-width: 700px) {
          .panel { flex-direction: row; flex-wrap: wrap; }
          h2 { width: 100%; }
          data-type-palette-entry { flex: 1 1 auto; }
        }
      </style>
      <aside class="panel" aria-labelledby="palette-title">
        <h2 id="palette-title">Data types</h2>
      </aside>
    `;
    root.querySelector(".panel")!.append(...this.entries);
  }
}

customElements.define("data-type-palette", DataTypePalette);
