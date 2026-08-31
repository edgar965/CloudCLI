/**
 * Which sessions are picked after a click.
 *
 * Held as three parts rather than one set, because a shift-range has to be
 * redrawable: dragging the end of a range back must let go of the rows it
 * passes over, while the rows picked one by one before it stay. Keeping the
 * range apart from the rest is what makes that possible - one flat set
 * cannot tell "picked by hand" from "swept up by the last shift-click".
 *
 * The anchor lives in here too, not in a ref beside it. It was a ref once,
 * read from inside a React state updater, and updaters run at render time -
 * by then the next click had already moved it. Carrying it through the same
 * updater as the selection makes that class of mistake impossible.
 */

export type PickState = {
  /** Picked by plain or ctrl clicks. Survives a range being redrawn. */
  base: ReadonlySet<string>;
  /** The range as it currently stands, from the anchor to the last shift-click. */
  range: readonly string[];
  /** Where a range starts. Only a plain or ctrl click moves it. */
  anchor: string | null;
};

export type PickClick = {
  /** The session clicked. */
  id: string;
  /** The sessions as the list shows them, for a range to walk. */
  orderedIds: string[];
  /** Whether the range from the anchor is meant. */
  shiftKey: boolean;
};

export const emptyPick: PickState = { base: new Set(), range: [], anchor: null };

/** Everything picked: the rows chosen by hand plus the range drawn over them. */
export function pickedIds(state: PickState): Set<string> {
  const all = new Set(state.base);
  for (const id of state.range) {
    all.add(id);
  }
  return all;
}

export function applyPick(state: PickState, { id, orderedIds, shiftKey }: PickClick): PickState {
  if (shiftKey && state.anchor) {
    const start = orderedIds.indexOf(state.anchor);
    const end = orderedIds.indexOf(id);
    // A row that has since dropped out of the list cannot anchor anything;
    // picking the one row clicked beats guessing at a range.
    if (start >= 0 && end >= 0) {
      const [lower, upper] = start < end ? [start, end] : [end, start];
      // Replaced, not added to, and the anchor stays put - so a second
      // shift-click moves the far end of the same range, the way it does in
      // a file list. Adding instead made every range a one-way street.
      return { ...state, range: orderedIds.slice(lower, upper + 1) };
    }
  }

  // A plain or ctrl click settles the range into what is picked by hand and
  // starts a new one here.
  const base = pickedIds(state);
  if (base.has(id)) {
    base.delete(id);
  } else {
    base.add(id);
  }
  return { base, range: [], anchor: id };
}
