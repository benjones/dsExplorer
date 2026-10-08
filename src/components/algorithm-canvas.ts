export class AlgorithmCanvas extends HTMLElement {
  connectedCallback(): void {
    this.innerHTML = `
      <section class="panel" aria-labelledby="canvas-title">
        <div class="heading">
          <h1 id="canvas-title">Algorithm canvas</h1>
          <span>Choose a data type to begin</span>
        </div>
        <svg viewBox="0 0 800 440" role="img" aria-label="Empty algorithm canvas">
          <rect x="1" y="1" width="798" height="438" rx="10" class="canvas-border"></rect>
          <text x="400" y="220" text-anchor="middle">Your visualization will appear here</text>
        </svg>
      </section>
    `;
  }
}

customElements.define("algorithm-canvas", AlgorithmCanvas);
