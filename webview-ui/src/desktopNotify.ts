import { DESKTOP_NOTIFY_STORAGE_KEY } from './constants.js';

/**
 * Desktop notifications (the browser's Notification API) for agents that need
 * you or failed: a per-browser preference, off until switched on in Settings.
 * Switching it on asks the browser for permission (it must happen in a click);
 * a refused permission leaves it off.
 */
function supported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

function readPref(): boolean {
  try {
    return window.localStorage.getItem(DESKTOP_NOTIFY_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

function writePref(on: boolean): void {
  try {
    window.localStorage.setItem(DESKTOP_NOTIFY_STORAGE_KEY, on ? 'on' : 'off');
  } catch {
    // storage unavailable: the choice lasts for this page only
  }
}

let wanted = supported() && readPref();

/** On, and the browser allows it. */
export function isDesktopNotifyEnabled(): boolean {
  return wanted && supported() && Notification.permission === 'granted';
}

/** Switch on (asking for permission when needed) or off; resolves to the new state. */
export async function setDesktopNotifyEnabled(on: boolean): Promise<boolean> {
  if (!on || !supported()) {
    wanted = false;
    writePref(false);
    return false;
  }
  let permission = Notification.permission;
  if (permission === 'default') {
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = 'denied';
    }
  }
  wanted = permission === 'granted';
  writePref(wanted);
  return wanted;
}

/** Show one notification; a press brings the office forward and runs `onPress`. */
export function showDesktopNotification(
  title: string,
  body: string,
  tag: string,
  onPress: () => void,
): void {
  if (!isDesktopNotifyEnabled()) return;
  try {
    const note = new Notification(title, { body, tag });
    note.onclick = () => {
      window.focus();
      onPress();
      note.close();
    };
  } catch {
    // some browsers refuse page-created notifications: nothing to show
  }
}
