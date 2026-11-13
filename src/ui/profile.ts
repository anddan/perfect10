// Who the player is: a random id for this device (made up once and kept in the browser, no accounts, the same way the
// football manager does it) and the name the player has chosen for the top list.

const DEVICE_KEY = "p10-device";
const NAME_KEY = "p10-name";

/** The longest name there can be. */
export const NAME_MAX = 16;

/** This device's id (made up once, kept in the browser; in memory too, where the browser will not store it). */
let device: string | null = null;
export function deviceId(): string {
  if (device) return device;
  try {
    device = localStorage.getItem(DEVICE_KEY);
  } catch {
    device = null;
  }
  if (!device) {
    device = `d${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    try {
      localStorage.setItem(DEVICE_KEY, device);
    } catch {
      /* only for this visit then */
    }
  }
  return device;
}

/** A name as it can be kept: no control characters or angle brackets, one space between words, at most NAME_MAX letters. */
export function cleanName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX)
    .trim();
}

/** The name the player has chosen ("" if none yet). */
export function playerName(): string {
  try {
    return cleanName(localStorage.getItem(NAME_KEY) ?? "");
  } catch {
    return "";
  }
}

/** Remembers the name (cleaned) and gives it back. */
export function setPlayerName(name: string): string {
  const clean = cleanName(name);
  try {
    localStorage.setItem(NAME_KEY, clean);
  } catch {
    /* only for this visit then */
  }
  return clean;
}
