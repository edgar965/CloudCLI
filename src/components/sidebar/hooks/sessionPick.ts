/**
 * Which sessions are picked after a click.
 *
 * Kept out of the hook so the decision can be tested as what it is - a pure
 * one - and, more importantly, so the anchor arrives as an argument.
 * Reading `anchor.current` from inside a `setState` updater was a real bug:
 * React runs updaters when it renders, and by then the second click of a
 * shift-range has already moved the anchor onto itself. Every range
 * collapsed into a plain toggle, silently.
 */

export type SessionPick = {
  /** The session clicked. */
  id: string;
  /** The sessions as the list shows them, for a range to walk. */
  orderedIds: string[];
  /** Whether the range from the previous click is meant. */
  shiftKey: boolean;
  /** Where the previous plain click landed - read before this click moved it. */
  anchor: string | null;
};

export function applyPick(
  previous: ReadonlySet<string>,
  { id, orderedIds, shiftKey, anchor }: SessionPick,
): Set<string> {
  const next = new Set(previous);

  if (shiftKey && anchor && anchor !== id) {
    const start = orderedIds.indexOf(anchor);
    const end = orderedIds.indexOf(id);
    // A row that has since dropped out of the list cannot anchor anything;
    // picking the one row clicked beats guessing at a range.
    if (start >= 0 && end >= 0) {
      const [lower, upper] = start < end ? [start, end] : [end, start];
      // A range always adds. Removing a swathe is what "clear" is for, and a
      // shift-click that silently unpicked half the list would be a worse
      // surprise than one that picks a few too many.
      for (const between of orderedIds.slice(lower, upper + 1)) {
        next.add(between);
      }
      return next;
    }
  }

  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return next;
}

export default applyPick;
