import assert from 'node:assert/strict';
import test from 'node:test';

import { applyPick, emptyPick, pickedIds } from './sessionPick';
import type { PickState } from './sessionPick';

/**
 * The picking rules, on the function the hook actually calls.
 *
 * An earlier version of this file re-implemented the rules to test them, and
 * stayed green while the shipped code was broken. It drives the real
 * function now, through `clickPicker`, which also makes React's timing
 * explicit: an update is queued at click time and only applied on the next
 * read, the way React applies it on the next render.
 */

const LIST = ['a', 'b', 'c', 'd', 'e', 'f'];

function clickPicker(ordered: string[] = LIST) {
  let state: PickState = emptyPick;
  const queue: ((previous: PickState) => PickState)[] = [];

  return {
    toggle(id: string, shiftKey = false) {
      queue.push((previous) => applyPick(previous, { id, orderedIds: ordered, shiftKey }));
    },
    picked() {
      for (const update of queue.splice(0)) {
        state = update(state);
      }
      const all = pickedIds(state);
      return ordered.filter((id) => all.has(id));
    },
  };
}

test('a click picks, a second click on the same row unpicks', () => {
  const p = clickPicker();
  p.toggle('b');
  assert.deepEqual(p.picked(), ['b']);

  p.toggle('b');
  assert.deepEqual(p.picked(), []);
});

test('shift-click takes everything between, ends included', () => {
  const p = clickPicker();
  p.toggle('b');
  p.toggle('d', true);
  assert.deepEqual(p.picked(), ['b', 'c', 'd']);
});

test('a range holds even when both clicks land before a render', () => {
  // The first regression: with the anchor read inside a state updater, both
  // clicks saw the anchor already moved onto the second row, and the range
  // quietly degraded into a plain toggle - ['b', 'd'], no 'c'.
  const p = clickPicker();
  p.toggle('b');
  p.toggle('d', true);
  assert.deepEqual(p.picked(), ['b', 'c', 'd'], 'c lies between b and d and must come along');
});

test('a second shift-click moves the end of the same range', () => {
  // The second regression: the range was added to the selection instead of
  // replacing the previous one, so dragging the end back changed nothing.
  const p = clickPicker();
  p.toggle('b');
  p.toggle('f', true);
  assert.deepEqual(p.picked(), ['b', 'c', 'd', 'e', 'f']);

  p.toggle('d', true);
  assert.deepEqual(p.picked(), ['b', 'c', 'd'], 'e and f are let go of again');
});

test('a range can be dragged across the anchor', () => {
  const p = clickPicker();
  p.toggle('d');
  p.toggle('f', true);
  assert.deepEqual(p.picked(), ['d', 'e', 'f']);

  p.toggle('b', true);
  assert.deepEqual(p.picked(), ['b', 'c', 'd'], 'the anchor stays at d, the far end swings over');
});

test('a range picked backwards is the same range', () => {
  const p = clickPicker();
  p.toggle('d');
  p.toggle('b', true);
  assert.deepEqual(p.picked(), ['b', 'c', 'd']);
});

test('rows picked by hand survive a range being redrawn', () => {
  const p = clickPicker();
  p.toggle('a');       // by hand
  p.toggle('c');       // by hand, anchor now c
  p.toggle('e', true); // range c..e
  assert.deepEqual(p.picked(), ['a', 'c', 'd', 'e']);

  p.toggle('d', true); // range shrinks to c..d
  assert.deepEqual(p.picked(), ['a', 'c', 'd'], 'a was never part of the range and stays');
});

test('a ctrl-click settles the range and starts a new one', () => {
  const p = clickPicker();
  p.toggle('a');
  p.toggle('c', true); // range a..c
  p.toggle('f');       // settles a..c, anchor now f
  p.toggle('e', true); // range e..f, a..c untouched
  assert.deepEqual(p.picked(), ['a', 'b', 'c', 'e', 'f']);
});

test('shift-clicking the anchor leaves just the anchor', () => {
  const p = clickPicker();
  p.toggle('c');
  p.toggle('e', true);
  p.toggle('c', true);
  assert.deepEqual(p.picked(), ['c']);
});

test('shift on the very first click picks just that row', () => {
  const p = clickPicker();
  p.toggle('c', true);
  assert.deepEqual(p.picked(), ['c'], 'without an anchor there is no range');
});

test('a row that is no longer in the list cannot anchor a range', () => {
  // The list reloads and drops "b" while it was the anchor.
  const state: PickState = { base: new Set(['b']), range: [], anchor: 'b' };
  const after = applyPick(state, { id: 'd', orderedIds: ['a', 'c', 'd', 'e'], shiftKey: true });
  assert.deepEqual(
    [...pickedIds(after)].sort(),
    ['b', 'd'],
    'falls back to picking the one row instead of guessing a range',
  );
});
