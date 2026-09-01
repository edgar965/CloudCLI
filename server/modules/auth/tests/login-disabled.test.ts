import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

/**
 * `CLOUDCLI_NO_LOGIN` turns the sign-in off for a server that only ever serves
 * the person running it.
 *
 * The flag is read once at module load, so each case imports a fresh copy with
 * its own environment - a cached module would carry the first value into every
 * later assertion.
 */

const ORIGINAL = process.env.CLOUDCLI_NO_LOGIN;

const loadWith = async (value: string | undefined) => {
  if (value === undefined) {
    delete process.env.CLOUDCLI_NO_LOGIN;
  } else {
    process.env.CLOUDCLI_NO_LOGIN = value;
  }
  // A query string makes the specifier unique, so the module is evaluated again.
  return import(`../../../shared/localLogin.js?case=${encodeURIComponent(String(value))}`);
};

beforeEach(() => {
  delete process.env.CLOUDCLI_NO_LOGIN;
});

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.CLOUDCLI_NO_LOGIN;
  } else {
    process.env.CLOUDCLI_NO_LOGIN = ORIGINAL;
  }
});

describe('the local login switch', () => {
  it('is off when the variable is not set', async () => {
    const { LOGIN_DISABLED } = await loadWith(undefined);
    assert.equal(LOGIN_DISABLED, false, 'a sign-in must never disappear by accident');
  });

  it('is off for an empty value', async () => {
    const { LOGIN_DISABLED } = await loadWith('');
    assert.equal(LOGIN_DISABLED, false);
  });

  for (const value of ['1', 'true', 'yes', 'on', 'TRUE', ' 1 ']) {
    it(`is on for ${JSON.stringify(value)}`, async () => {
      const { LOGIN_DISABLED } = await loadWith(value);
      assert.equal(LOGIN_DISABLED, true);
    });
  }

  for (const value of ['0', 'false', 'no', 'off', 'maybe']) {
    it(`stays off for ${JSON.stringify(value)}`, async () => {
      const { LOGIN_DISABLED } = await loadWith(value);
      assert.equal(LOGIN_DISABLED, false, 'anything but an explicit yes keeps the login');
    });
  }

  it('warns louder when the server is not local-only', async () => {
    const { warnIfLoginDisabled } = await loadWith('1');
    const messages: string[] = [];
    const original = console.warn;
    console.warn = (message: unknown) => { messages.push(String(message)); };
    try {
      warnIfLoginDisabled('127.0.0.1');
      warnIfLoginDisabled('0.0.0.0');
    } finally {
      console.warn = original;
    }

    assert.equal(messages.length, 2);
    assert.ok(!messages[0].includes('full access'), 'a local-only server gets the short note');
    assert.ok(messages[1].includes('full access'), 'a reachable one has to say what it means');
  });

  it('says nothing at all while the login is on', async () => {
    const { warnIfLoginDisabled } = await loadWith(undefined);
    const messages: string[] = [];
    const original = console.warn;
    console.warn = (message: unknown) => { messages.push(String(message)); };
    try {
      warnIfLoginDisabled('0.0.0.0');
    } finally {
      console.warn = original;
    }

    assert.equal(messages.length, 0);
  });
});
