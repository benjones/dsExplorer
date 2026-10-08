export class DataTypeEditor extends HTMLElement {
  connectedCallback(): void {
    this.innerHTML = `
      <section class="panel" aria-labelledby="editor-title">
        <div class="heading">
          <h2 id="editor-title">Data type editor</h2>
          <button type="button">Apply</button>
        </div>
        <label>
          Definition
          <textarea spellcheck="false" aria-label="Data type definition">{
  "type": "array",
  "values": [1, 2, 3]
}</textarea>
        </label>
      </section>
    `;
  }
}

customElements.define("data-type-editor", DataTypeEditor);
