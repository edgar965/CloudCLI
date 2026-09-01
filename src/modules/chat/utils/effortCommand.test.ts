import assert from 'node:assert/strict';

import { test } from 'vitest';

import { resolveEffortCommand } from '@/modules/chat/utils/effortCommand';

const OPTIONS = [
  { value: 'low' },
  { value: 'medium' },
  { value: 'high' },
  { value: 'xhigh' },
  { value: 'max' },
];

test('a value this model offers is applied', () => {
  const result = resolveEffortCommand('max', 'high', OPTIONS);
  assert.equal(result.effort, 'max');
  assert.match(result.message, /max/);
});

test('the menu label is capitalised, the value is not', () => {
  // The button reads "Opus · Xhigh", so that is what gets typed back.
  assert.equal(resolveEffortCommand('Xhigh', 'high', OPTIONS).effort, 'xhigh');
  assert.equal(resolveEffortCommand('  MAX  ', 'high', OPTIONS).effort, 'max');
});

test('without an argument nothing changes and the state is reported', () => {
  const result = resolveEffortCommand('', 'xhigh', OPTIONS);
  assert.equal(result.effort, null, 'plain /effort must be safe to type');
  assert.match(result.message, /xhigh/);
  assert.match(result.message, /low, medium, high, xhigh, max/);
});

test('a value the model does not offer is refused, with the list', () => {
  const result = resolveEffortCommand('ultra', 'high', OPTIONS);
  assert.equal(result.effort, null);
  assert.match(result.message, /not one of this model's efforts/);
  assert.match(result.message, /low, medium, high, xhigh, max/);
});

test('setting what is already set changes nothing', () => {
  const result = resolveEffortCommand('high', 'high', OPTIONS);
  assert.equal(result.effort, null, 'no request for a value that is already in force');
  assert.match(result.message, /already/);
});

test('a model without efforts says so instead of offering an empty list', () => {
  const result = resolveEffortCommand('high', null, []);
  assert.equal(result.effort, null);
  assert.match(result.message, /no reasoning effort/i);
});

test('with nothing set yet, a first value still applies', () => {
  const result = resolveEffortCommand('low', null, OPTIONS);
  assert.equal(result.effort, 'low');
});
