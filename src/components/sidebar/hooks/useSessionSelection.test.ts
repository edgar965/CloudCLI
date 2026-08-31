import assert from 'node:assert/strict';
import test from 'node:test';

import { applyPick } from './sessionPick';

/**
 * The picking rules, on the function the hook actually calls.
 *
 * An earlier version of this file re-implemented the rules to test them, and
 * stayed green while the shipped code was broken: the hook read its anchor
 * inside a React state updater, which runs at render time, long after the
 * click that moved it. The lesson is in `clickPicker` below - the anchor is
 * read when the click happens, and the updates are applied late on purpose.
 */

const LIST = ['a', 'b', 'c', 'd', 'e'];

/**
 * A stand-in for the hook, with React's timing made explicit: `toggle`
 * queues an update and moves the anchor at once, and the queue is only
 * drained on `picked()` - the way React drains it on the next render.
 */
function clickPicker(ordered: string[] = LIST) {
  let selected: ReadonlySet<string> = new Set();
  const queue: ((previous: ReadonlySet<string>) => Set<string>)[] = [];
  let anchor: string | null = null;

  return {
    toggle(id: string, shiftKey = false) {
      const from = anchor;
      anchor = id;
      queue.push((previous) => applyPick(previous, { id, orderedIds: ordered, shiftKey, anchor: from }));
    },
    setAnchor(id: string | null) { anchor = id; },
    picked() {
      for (const update of queue.splice(0)) {
        selected = update(selected);
      }
      return LIST.filter((id) => selected.has(id)).concat(
        [...selected].filter((id) => !LIST.includes(id)),
      );
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
  // The regression: two clicks in a row, nothing rendered in between. With
  // the anchor read inside the updater this returned ['b', 'd'] - the middle
  // row missing, the range quietly degraded to a plain toggle.
  const p = clickPicker();
  p.toggle('b');
  p.toggle('d', true);
  assert.deepEqual(p.picked(), ['b', 'c', 'd'], 'c lies between b and d and must come along');
});

test('a range picked backwards is the same range', () => {
  const p = clickPicker();
  p.toggle('d');
  p.toggle('b', true);
  assert.deepEqual(p.picked(), ['b', 'c', 'd']);
});

test('a range only ever adds - it never unpicks what was already there', () => {
  const p = clickPicker();
  p.toggle('a');
  p.toggle('e');       // a and e, anchor at e
  p.toggle('c', true); // range e..c
  assert.deepEqual(p.picked(), ['a', 'c', 'd', 'e'], 'a survives a range that does not cover it');
});

test('the anchor moves to the last row clicked', () => {
  const p = clickPicker();
  p.toggle('a');
  p.toggle('c');       // anchor now c
  p.toggle('e', true); // range c..e, not a..e
  assert.deepEqual(p.picked(), ['a', 'c', 'd', 'e']);
  assert.equal(p.picked().includes('b'), false, 'b lies before the anchor and stays out');
});

test('shift on the very first click picks just that row', () => {
  const p = clickPicker();
  p.toggle('c', true);
  assert.deepEqual(p.picked(), ['c'], 'without an anchor there is no range');
});

test('a row that is no longer in the list cannot anchor a range', () => {
  // The list reloads and drops "b" while it was the anchor.
  const shortened = ['a', 'c', 'd', 'e'];
  assert.deepEqual(
    [...applyPick(new Set(['b']), { id: 'd', orderedIds: shortened, shiftKey: true, anchor: 'b' })].sort(),
    ['b', 'd'],
    'falls back to picking the one row instead of guessing a range',
  );
});
