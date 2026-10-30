import { historyEntryLabel, type HistoryEntry } from "./history-entry.js";

export class HistoryList extends HTMLElement {
  private readonly entries: HistoryEntry[] = [];

  connectedCallback(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: "open" });
    root.innerHTML = `
      <link rel="stylesheet" href="${new URL("./history-list.css", import.meta.url).href}" />
      <aside class="panel" aria-labelledby="history-title">
        <h2 id="history-title">History</h2>
        <ol></ol>
      </aside>
    `;
    root.querySelector("ol")!.append(...this.entries.map((entry) => this.createEntry(entry)));
  }

  addEntry(entry: HistoryEntry): void {
    this.entries.push(entry);
    this.shadowRoot?.querySelector("ol")?.append(this.createEntry(entry));
  }

  private createEntry(entry: HistoryEntry): HTMLLIElement {
    const item = document.createElement("li");
    item.textContent = historyEntryLabel(entry);
    return item;
  }
}

customElements.define("history-list", HistoryList);
