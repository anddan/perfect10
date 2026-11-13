// The top list of the endless game (Firebase Firestore, one document per device in "highscores": its name and its best score).
// No accounts; the rules (firestore.rules) let a device only add its own score and only raise it. Nothing here is loaded until it
// is needed, and while the project is not connected (see firebaseConfig.ts) everything stays on the device.
import {FIREBASE_CONFIG} from "./firebaseConfig";
import {cleanName, deviceId} from "./profile";

export interface ScoreRow {
  device: string;
  name: string;
  score: number;
}

/** What the top list is doing: not connected, being fetched, here, or out of reach. */
export interface Board {
  status: "off" | "loading" | "ok" | "error";
  rows: ScoreRow[];
}

export const board: Board = {status: FIREBASE_CONFIG ? "loading" : "off", rows: []};

/** The most rows the top list shows. */
export const TOP_ROWS = 10;
/** The highest score the rules accept. */
export const SCORE_MAX = 10_000_000;

export function scoresEnabled(): boolean {
  return FIREBASE_CONFIG !== null;
}

/** The document of a device in the top list. */
export function scoreDoc(device: string, name: string, score: number, at: number): {device: string; name: string; score: number; at: number} {
  return {device, name: cleanName(name), score: Math.min(SCORE_MAX, Math.max(0, Math.floor(score))), at};
}

/** What was read from the database, as rows: only the ones that are shaped right, the best first, no more than TOP_ROWS. */
export function toRows(docs: unknown[]): ScoreRow[] {
  const rows: ScoreRow[] = [];
  for (const d of docs) {
    if (typeof d !== "object" || d === null) continue;
    const {device, name, score} = d as Record<string, unknown>;
    if (typeof device !== "string" || typeof name !== "string" || typeof score !== "number" || !Number.isFinite(score)) continue;
    const clean = cleanName(name);
    if (!clean || score < 0) continue;
    rows.push({device, name: clean, score: Math.floor(score)});
  }
  return rows.sort((a, b) => b.score - a.score).slice(0, TOP_ROWS);
}

/** The database (loaded the first time it is needed). */
async function firestore() {
  const [app, fs] = await Promise.all([import("firebase/app"), import("firebase/firestore")]);
  if (!FIREBASE_CONFIG) throw new Error("not connected");
  return {fs, db: fs.getFirestore(app.getApps()[0] ?? app.initializeApp(FIREBASE_CONFIG))};
}

/** Sends this device's best score with its name: the score only ever goes up, the name can change. Never throws. */
export async function submitScore(name: string, score: number): Promise<boolean> {
  const clean = cleanName(name);
  if (!scoresEnabled() || !clean || score <= 0) return false;
  try {
    const {fs, db} = await firestore();
    const id = deviceId();
    const ref = fs.doc(db, "highscores", id);
    const snap = await fs.getDoc(ref);
    const before = snap.exists() ? Number(snap.data().score) || 0 : 0;
    if (snap.exists() && before >= score && snap.data().name === clean) return true;
    await fs.setDoc(ref, scoreDoc(id, clean, Math.max(before, score), Date.now()));
    return true;
  } catch {
    return false;
  }
}

/** Fetches the top list into `board` (the screen draws it from there). Never throws. */
export async function loadBoard(): Promise<void> {
  if (!scoresEnabled()) {
    board.status = "off";
    board.rows = [];
    return;
  }
  board.status = "loading";
  try {
    const {fs, db} = await firestore();
    const snap = await fs.getDocs(fs.query(fs.collection(db, "highscores"), fs.orderBy("score", "desc"), fs.limit(TOP_ROWS)));
    board.rows = toRows(snap.docs.map((d) => d.data()));
    board.status = "ok";
  } catch {
    board.status = "error";
  }
}
