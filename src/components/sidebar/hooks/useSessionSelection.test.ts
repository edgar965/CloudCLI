import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * The picking rules, without React.
 *
 * The reducer below is the same one `useSessionSelection` runs inside its
 * state updater; testing it here keeps the range logic - the part with an
 * off-by-one in every direction - checkable without a renderer.
 */

type State = { selected: Set<string>; anchor: string | null };

function toggle(state: State, id: string, ordered: string[], shiftKey = false): State {
  const next = new Set(state.selected);
  const from = state.anchor;

  if (shiftKey && from && from !== id) {
    const start = ordered.indexOf(from);
    const end = ordered.indexOf(id);
    if (start >= 0 && end >= 0) {
      const [lower, upper] = start < end ? [start, end] : [end, start];
      for (const between of ordered.slice(lower, upper + 1)) {
        next.add(between);
      }
      return { selected: next, anchor: id };
    }
  }

  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return { selected: next, anchor: id };
}

const LIST = ['a', 'b', 'c', 'd', 'e'];
const empty = (): State => ({ selected: new Set(), anchor: null });
const picked = (state: State) => LIST.filter((id) => state.selected.has(id));

test('a click picks, a second click on the same row unpicks', () => {
  let state = toggle(empty(), 'b', LIST);
  assert.deepEqual(picked(state), ['b']);

  state = toggle(state, 'b', LIST);
  assert.deepEqual(picked(state), []);
});

test('shift-click takes everything between, ends included', () => {
  let state = toggle(empty(), 'b', LIST);
  state = toggle(state, 'd', LIST, true);
  assert.deepEqual(picked(state), ['b', 'c', 'd']);
});

test('a range picked backwards is the same range', () => {
  let state = toggle(empty(), 'd', LIST);
  state = toggle(state, 'b', LIST, true);
  assert.deepEqual(picked(state), ['b', 'c', 'd']);
});

test('a range only ever adds - it never unpicks what was already there', () => {
  let state = toggle(empty(), 'a', LIST);
  state = toggle(state, 'e', LIST);        // a and e, anchor at e
  state = toggle(state, 'c', LIST, true);  // range e..c
  assert.deepEqual(picked(state), ['a', 'c', 'd', 'e'], 'a survives a range that does not cover it');
});

test('the anchor moves to the last row clicked', () => {
  let state = toggle(empty(), 'a', LIST);
  state = toggle(state, 'c', LIST);        // anchor now c
  state = toggle(state, 'e', LIST, true);  // range c..e, not a..e
  assert.deepEqual(picked(state), ['a', 'c', 'd', 'e']);
  assert.equal(state.selected.has('b'), false, 'b lies before the anchor and stays out');
});

test('shift on the very first click picks just that row', () => {
  const state = toggle(empty(), 'c', LIST, true);
  assert.deepEqual(picked(state), ['c'], 'without an anchor there is no range');
});

test('a row that is no longer in the list cannot anchor a range', () => {
  // The list reloads and drops "b" while it was the anchor.
  let state: State = { selected: new Set(['b']), anchor: 'b' };
  state = toggle(state, 'd', ['a', 'c', 'd', 'e'], true);
  assert.deepEqual(
    [...state.selected].sort(),
    ['b', 'd'],
    'falls back to picking the one row instead of guessing a range',
  );
});
