// The top lists of the endless game and of the match modes (Firebase Firestore, one document per device in "highscores" (the endless game), "highscores_save" and
// "highscores_sixeight": its name and its best score).
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

/** The games that have a top list: the endless game and the two match modes. */
export type ScoreMode = "endless" | "save" | "sixeight" | "defend" | "ice" | "fast" | "find" | "shield" | "jet" | "comet" | "snake";
export const SCORE_MODES: readonly ScoreMode[] = ["endless", "save", "sixeight", "defend", "ice", "fast", "find", "shield", "jet", "comet", "snake"];

/** The collection of the database that holds the list of each. */
export const COLLECTION: Record<ScoreMode, string> = {endless: "highscores", save: "highscores_save", sixeight: "highscores_sixeight", defend: "highscores_defend", ice: "highscores_ice", fast: "highscores_fast", find: "highscores_find", shield: "highscores_shield", jet: "highscores_jet", comet: "highscores_comet", snake: "highscores_snake"};

const emptyBoard = (): Board => ({status: FIREBASE_CONFIG ? "loading" : "off", rows: []});
export const boards: Record<ScoreMode, Board> = {endless: emptyBoard(), save: emptyBoard(), sixeight: emptyBoard(), defend: emptyBoard(), ice: emptyBoard(), fast: emptyBoard(), find: emptyBoard(), shield: emptyBoard(), jet: emptyBoard(), comet: emptyBoard(), snake: emptyBoard()};
/** The top list of the endless game. */
export const board: Board = boards.endless;

/** The most rows the top list shows. */
export const TOP_ROWS = 10;
/** The highest score the rules accept. */
export const SCORE_MAX = 1_000_000_000_000;

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

/** Sends this device's best score of a game with its name: the score only ever goes up, the name can change. Never throws. */
export async function submitScore(name: string, score: number, mode: ScoreMode = "endless"): Promise<boolean> {
  const clean = cleanName(name);
  if (!scoresEnabled() || !clean || score <= 0) return false;
  try {
    const {fs, db} = await firestore();
    const id = deviceId();
    const ref = fs.doc(db, COLLECTION[mode], id);
    const snap = await fs.getDoc(ref);
    const before = snap.exists() ? Number(snap.data().score) || 0 : 0;
    if (snap.exists() && before >= score && snap.data().name === clean) return true;
    await fs.setDoc(ref, scoreDoc(id, clean, Math.max(before, score), Date.now()));
    return true;
  } catch {
    return false;
  }
}

/** Fetches the top list of a game into its board (the screen draws it from there). Never throws. */
export async function loadBoard(mode: ScoreMode = "endless"): Promise<void> {
  const bd = boards[mode];
  if (!scoresEnabled()) {
    bd.status = "off";
    bd.rows = [];
    return;
  }
  bd.status = "loading";
  try {
    const {fs, db} = await firestore();
    const snap = await fs.getDocs(fs.query(fs.collection(db, COLLECTION[mode]), fs.orderBy("score", "desc"), fs.limit(TOP_ROWS)));
    bd.rows = toRows(snap.docs.map((d) => d.data()));
    bd.status = "ok";
  } catch {
    bd.status = "error";
  }
}
