import "./algorithm-canvas.js";
import "./data-type-editor.js";
import "./data-type-palette.js";

class DsExplorer extends HTMLElement {
  connectedCallback(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <style>
        :host, *, *::before, *::after { box-sizing: border-box; }
        :host {
          display: block;
          min-height: 100vh;
          color: var(--color-text);
          background: var(--color-page);
          font-family: system-ui, sans-serif;
        }
        .workspace {
          display: grid;
          grid-template-areas: "palette canvas" "palette editor";
          grid-template-columns: 15rem minmax(0, 1fr);
          grid-template-rows: minmax(0, 1fr) 13rem;
          gap: 1px;
          min-height: 100vh;
          background: var(--color-divider);
        }
        data-type-palette { grid-area: palette; }
        algorithm-canvas { grid-area: canvas; }
        data-type-editor { grid-area: editor; }
        data-type-palette, algorithm-canvas, data-type-editor { min-width: 0; min-height: 0; }
        @media (max-width: 700px) {
          .workspace {
            grid-template-areas: "palette" "canvas" "editor";
            grid-template-columns: 1fr;
            grid-template-rows: auto minmax(20rem, 1fr) auto;
          }
        }
      </style>
      <section class="workspace" aria-label="DS Explorer workspace">
        <data-type-palette></data-type-palette>
        <algorithm-canvas></algorithm-canvas>
        <data-type-editor></data-type-editor>
      </section>
    `;
  }
}

customElements.define("ds-explorer", DsExplorer);
