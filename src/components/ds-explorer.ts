import "./algorithm-canvas.js";
import "./data-type-editor.js";
import "./data-type-palette.js";

class DsExplorer extends HTMLElement {
  connectedCallback(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <link rel="stylesheet" href="${new URL("./ds-explorer.css", import.meta.url).href}" />
      <section class="workspace" aria-label="DS Explorer workspace">
        <data-type-palette></data-type-palette>
        <algorithm-canvas></algorithm-canvas>
        <data-type-editor></data-type-editor>
      </section>
    `;
  }
}

customElements.define("ds-explorer", DsExplorer);
