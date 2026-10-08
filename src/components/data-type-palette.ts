export class DataTypePalette extends HTMLElement {
  connectedCallback(): void {
    this.innerHTML = `
      <aside class="panel" aria-labelledby="palette-title">
        <h2 id="palette-title">Data types</h2>
        <button type="button">Array</button>
        <button type="button">Linked list</button>
        <button type="button">Stack</button>
        <button type="button">Queue</button>
        <button type="button">Tree</button>
        <button type="button">Graph</button>
      </aside>
    `;
  }
}

customElements.define("data-type-palette", DataTypePalette);
