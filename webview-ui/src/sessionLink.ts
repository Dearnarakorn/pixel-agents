import { isBrowserRuntime } from './runtime.js';

/** Schemes a session link may never use: it is handed to the browser as a
 *  navigation, and only an app's own custom scheme belongs there. */
const REFUSED_SCHEMES = new Set(['http', 'https', 'javascript', 'data', 'file', 'blob', 'about']);

/**
 * Follow an agent's session link (see Character.link): the browser passes the
 * custom-scheme URL to the operating system, which brings the session to the
 * front in the CLI's own app. The page itself does not navigate.
 *
 * Standalone browser only — a VS Code webview cannot open external schemes.
 * Returns whether the link was handed over.
 */
export function openSessionLink(link: string): boolean {
  if (!isBrowserRuntime) return false;
  const match = /^([a-z][a-z0-9+.-]*):\/\/\S+$/i.exec(link);
  if (!match || REFUSED_SCHEMES.has(match[1].toLowerCase())) return false;
  window.location.assign(link);
  return true;
}
