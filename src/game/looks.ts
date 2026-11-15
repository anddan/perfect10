// The looks that can be bought with coins: only how things look, never how they play. There are five kinds, and one of each is chosen at a time.

export type LookKind = "cupColor" | "pattern" | "room" | "tint" | "numbers";

export interface LookDef {
  kind: LookKind;
  id: string;
  /** What it costs in coins (0: it is there from the start). */
  price: number;
}

/** The look that is on from the start, for every kind. */
export const DEFAULT_LOOK: Record<LookKind, string> = {cupColor: "porcelain", pattern: "none", room: "auto", tint: "none", numbers: "classic"};

export const LOOK_KINDS: readonly LookKind[] = ["cupColor", "pattern", "room", "tint", "numbers"];

export const LOOKS: readonly LookDef[] = [
  // The colour of the ordinary cups (a cup with a power keeps the colour of its power).
  {kind: "cupColor", id: "porcelain", price: 0},
  {kind: "cupColor", id: "sky", price: 96},
  {kind: "cupColor", id: "rose", price: 96},
  {kind: "cupColor", id: "mint", price: 96},
  {kind: "cupColor", id: "midnight", price: 144},
  {kind: "cupColor", id: "sunset", price: 144},
  {kind: "cupColor", id: "lemon", price: 96},
  {kind: "cupColor", id: "lilac", price: 96},
  {kind: "cupColor", id: "graphite", price: 144},
  // A pattern on every cup.
  {kind: "pattern", id: "none", price: 0},
  {kind: "pattern", id: "dots", price: 120},
  {kind: "pattern", id: "stripes", price: 120},
  {kind: "pattern", id: "stars", price: 168},
  {kind: "pattern", id: "waves", price: 120},
  {kind: "pattern", id: "hearts", price: 168},
  {kind: "pattern", id: "checks", price: 120},
  // The room behind the game: by chapter (as it is), or the same one everywhere.
  {kind: "room", id: "auto", price: 0},
  {kind: "room", id: "classroom", price: 180},
  {kind: "room", id: "cafe", price: 180},
  {kind: "room", id: "library", price: 180},
  {kind: "room", id: "bakery", price: 180},
  {kind: "room", id: "spaceship", price: 240},
  {kind: "room", id: "terrace", price: 240},
  {kind: "room", id: "greenhouse", price: 240},
  {kind: "room", id: "beach", price: 240},
  // The colour of the light in the room.
  {kind: "tint", id: "none", price: 0},
  {kind: "tint", id: "sunset", price: 144},
  {kind: "tint", id: "night", price: 144},
  {kind: "tint", id: "forest", price: 144},
  {kind: "tint", id: "sepia", price: 144},
  {kind: "tint", id: "ocean", price: 144},
  {kind: "tint", id: "rose", price: 144},
  {kind: "tint", id: "dawn", price: 144},
  {kind: "tint", id: "mono", price: 144},
  // How the numbers look.
  {kind: "numbers", id: "classic", price: 0},
  {kind: "numbers", id: "neon", price: 240},
  {kind: "numbers", id: "candy", price: 240},
  {kind: "numbers", id: "wood", price: 240},
  {kind: "numbers", id: "dark", price: 180},
  {kind: "numbers", id: "minimal", price: 180},
  {kind: "numbers", id: "glass", price: 240},
  {kind: "numbers", id: "chalk", price: 240},
  // The colours the wrong way round (a plus number is red, a minus number green, blue and yellow swap): hard to play.
  {kind: "numbers", id: "reverse", price: 300},
];

/** The looks of one kind, in the order of the shop. */
export function looksOf(kind: LookKind): LookDef[] {
  return LOOKS.filter((l) => l.kind === kind);
}

export function findLook(kind: LookKind, id: unknown): LookDef | undefined {
  return LOOKS.find((l) => l.kind === kind && l.id === id);
}

/** What is kept for a bought look in the list of what is owned. */
export function lookKey(kind: LookKind, id: string): string {
  return kind + ":" + id;
}
