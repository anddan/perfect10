// What the player writes on the back cover of the book: a question (support), an idea or a problem. It is kept in the database (Firebase Firestore, the
// collection "feedback"; see firestore.rules: anyone can add one, nobody can read, change or delete them from the game). Nothing is loaded until a message is
// sent, and while the project is not connected (see firebaseConfig.ts) nothing is sent.
import {FIREBASE_CONFIG} from "./firebaseConfig";
import {cleanName, deviceId, playerName} from "./profile";

export type FeedbackKind = "support" | "idea" | "problem";
export const FEEDBACK_KINDS: readonly FeedbackKind[] = ["support", "idea", "problem"];

/** The most letters a message can have (the rules accept no more). */
export const FEEDBACK_MAX = 1000;

/** The seconds that have to pass between two messages from the same device (so that nobody fills the database by mistake). */
export const FEEDBACK_WAIT = 30;

export function isFeedbackKind(k: unknown): k is FeedbackKind {
  return typeof k === "string" && (FEEDBACK_KINDS as readonly string[]).includes(k);
}

/** A message as it can be kept: no control characters (new lines stay) or angle brackets, no more than one empty line in a row, at most FEEDBACK_MAX letters. */
export function cleanFeedback(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, FEEDBACK_MAX)
    .trim();
}

/** The document of a message in the database. */
export function feedbackDoc(kind: FeedbackKind, text: string, device: string, name: string, lang: string, at: number): {device: string; name: string; kind: FeedbackKind; text: string; lang: string; at: number} {
  return {device: device.slice(0, 40), name: cleanName(name), kind, text: cleanFeedback(text), lang: lang.slice(0, 5), at};
}

/** What happened when a message was sent: it was, the project is not connected, there was nothing to send, it is too soon after the last one, or it did not work. */
export type SendResult = "sent" | "off" | "empty" | "wait" | "error";

let lastSent = 0;

/** Sends a message (kept in the database, with the id of the device and the name of the player, if there is one). Never throws. */
export async function submitFeedback(kind: FeedbackKind, text: string, lang: string, now: number = Date.now()): Promise<SendResult> {
  const clean = cleanFeedback(text);
  if (!clean || !isFeedbackKind(kind)) return "empty";
  if (!FIREBASE_CONFIG) return "off";
  if (now - lastSent < FEEDBACK_WAIT * 1000) return "wait";
  try {
    const [app, fs] = await Promise.all([import("firebase/app"), import("firebase/firestore")]);
    const db = fs.getFirestore(app.getApps()[0] ?? app.initializeApp(FIREBASE_CONFIG));
    await fs.addDoc(fs.collection(db, "feedback"), feedbackDoc(kind, clean, deviceId(), playerName(), lang, now));
    lastSent = now;
    return "sent";
  } catch {
    return "error";
  }
}
