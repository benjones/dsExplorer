export interface HistoryEntryBase {
  kind: string;
}

export interface ValueUpdateHistoryEntry extends HistoryEntryBase {
  kind: "update-value";
  previousValue?: string;
  value: string;
}

export interface ReferenceUpdateHistoryEntry extends HistoryEntryBase {
  kind: "update-reference";
  previousTarget: string | null;
  target: string | null;
}

export type HistoryEntry = ValueUpdateHistoryEntry | ReferenceUpdateHistoryEntry;

function displayValue(value: string | undefined): string {
  if (value === undefined) return "?";
  return value || '""';
}

function displayReference(target: string | null): string {
  return target ?? "null";
}

export function historyEntryLabel(entry: HistoryEntry): string {
  switch (entry.kind) {
    case "update-value":
      return `Update value from ${displayValue(entry.previousValue)} to ${displayValue(entry.value)}`;
    case "update-reference":
      return `Update reference from ${displayReference(entry.previousTarget)} to ${displayReference(entry.target)}`;
  }
}
