/**
 * A link that brings a Claude Code session to the front in the Claude desktop
 * app: `claude://resume?session=<uuid>`.
 *
 * The desktop app registers the `claude://` scheme; this `resume` form is not
 * in its documentation (which lists only links for NEW chats and sessions),
 * but the app switches to the session when it is opened. If a later release
 * drops it, the link simply does nothing.
 *
 * Only a plain UUID is ever put into the link: the id comes from a transcript
 * file name and ends up in a URL the browser hands to the operating system.
 */

const SESSION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sessionLink(sessionId: string): string | undefined {
  return SESSION_UUID.test(sessionId) ? `claude://resume?session=${sessionId}` : undefined;
}
