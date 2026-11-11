/** Move `movedId` to sit before `beforeId` (or to the end when beforeId is null). Returns the new id order. */
export function reorder(ids: string[], movedId: string, beforeId: string | null): string[] {
  const rest = ids.filter(i => i !== movedId);
  if (beforeId === null || beforeId === movedId) return beforeId === movedId ? ids : [...rest, movedId];
  const at = rest.indexOf(beforeId);
  if (at === -1) return [...rest, movedId];
  return [...rest.slice(0, at), movedId, ...rest.slice(at)];
}
