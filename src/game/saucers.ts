// The saucers of the shop: what each cup stands on. Only four can be on the desk (one under each cup), so they have to be chosen; the ones of the same
// kind add up (four slow saucers make the numbers fall 20% slower).

/** The saucers that can be bought: "slow" (the numbers fall slower), "sparse" (fewer numbers), "special" (more special numbers) and "points" (more points). */
export const SAUCERS = ["slow", "sparse", "special", "points"] as const;

export type SaucerKind = (typeof SAUCERS)[number];

/** How many saucers fit on the desk: one under each cup. */
export const SAUCER_SLOTS = 4;

/** What a saucer costs in coins. */
export const SAUCER_PRICE: Record<SaucerKind, number> = {slow: 600, sparse: 720, special: 520, points: 900};

/** What one saucer does, as a fraction of how it is now (the numbers fall 5% slower, 10% fewer of them come, 10% more special ones, 50% more points). */
export const SAUCER_EFFECT: Record<SaucerKind, number> = {slow: 0.05, sparse: 0.1, special: 0.1, points: 0.5};

/**
 * The bonus for putting two, three or four saucers of the same kind on the desk: as many extra saucers of that kind as this count (by how many there are).
 * Two slow saucers work like two and a half, three like four, and four like six.
 */
export const SAUCER_SET_BONUS = [0, 0, 0.5, 1, 2] as const;

/** How many saucers of a kind they work like, with the bonus for two, three or four of a kind counted in. */
export function saucerPower(count: number): number {
  const n = Math.min(SAUCER_SET_BONUS.length - 1, Math.max(0, Math.floor(count)));
  return n + SAUCER_SET_BONUS[n];
}

/** Is this a saucer of the shop? (what the player has kept in the browser is not to be trusted) */
export function isSaucer(k: unknown): k is SaucerKind {
  return typeof k === "string" && (SAUCERS as readonly string[]).includes(k);
}
