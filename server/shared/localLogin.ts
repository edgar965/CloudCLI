/**
 * Turns the login off for a server that only ever serves the person running it.
 *
 * `CLOUDCLI_NO_LOGIN=1` lets every request through as the first user in the
 * database, the same way platform mode does. It exists because a desktop app
 * on one machine pays for the login several times over: each window runs with
 * its own Electron profile, so each one keeps its own `localStorage`, and a
 * token that goes missing there - a profile that was cleared, an address that
 * moved from `localhost` to `127.0.0.1`, a request that raced the token into
 * place - puts a sign-in screen in front of a machine that is already the
 * user's own.
 *
 * It is off unless asked for, and it is a real decision: anything that can
 * reach the port is that user. Bind to 127.0.0.1 while it is on. Turning on
 * "Allow LAN Access to Local Server" in the desktop menu with this set hands
 * the whole workspace to the network the machine is in.
 */

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

export const LOGIN_DISABLED = TRUTHY.has(
  (process.env.CLOUDCLI_NO_LOGIN ?? '').trim().toLowerCase(),
);

/** Warns once at startup, so this is never on without anyone noticing. */
export function warnIfLoginDisabled(host: string): void {
  if (!LOGIN_DISABLED) {
    return;
  }

  const localOnly = host === '127.0.0.1' || host === 'localhost' || host === '::1';
  console.warn(
    localOnly
      ? '[auth] CLOUDCLI_NO_LOGIN is set: no sign-in is required on this server.'
      : `[auth] CLOUDCLI_NO_LOGIN is set AND the server listens on ${host}: `
        + 'everyone who can reach this address has full access to the workspace.',
  );
}
