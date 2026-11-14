// Energy: every try at a level costs one. At most 10; one comes back every 10 minutes while it is below 10, and watching an ad gives
// a few more. It is kept in the browser (see loadEnergy), so it keeps counting while the app is closed.

export const ENERGY_MAX = 10;
/** Seconds until one point of energy comes back. */
export const ENERGY_REGEN_SECONDS = 600;
/** How much energy one ad gives. */
export const ENERGY_PER_AD = 3;

export interface Energy {
  /** How many points there are now (0 to ENERGY_MAX). */
  n: number;
  /** When (milliseconds) the last point was got or spent: the next one comes ENERGY_REGEN_SECONDS after it. It does not matter while the energy is full. */
  at: number;
}

export function createEnergy(now: number): Energy {
  return {n: ENERGY_MAX, at: now};
}

/** Counts up the points that have come back since last time. */
export function refreshEnergy(e: Energy, now: number): void {
  if (e.n >= ENERGY_MAX) {
    e.n = ENERGY_MAX;
    e.at = now;
    return;
  }
  if (now < e.at) {
    e.at = now; // (the clock was set back)
    return;
  }
  const gained = Math.floor((now - e.at) / (ENERGY_REGEN_SECONDS * 1000));
  if (gained <= 0) return;
  e.n = Math.min(ENERGY_MAX, e.n + gained);
  e.at = e.n >= ENERGY_MAX ? now : e.at + gained * ENERGY_REGEN_SECONDS * 1000;
}

/** Pays one point for a try. False (and nothing is paid) if there is none. */
export function spendEnergy(e: Energy, now: number): boolean {
  refreshEnergy(e, now);
  if (e.n < 1) return false;
  if (e.n >= ENERGY_MAX) e.at = now; // (the wait for the next point starts when the energy drops below full)
  e.n -= 1;
  return true;
}

/** Gives points (an ad), never above the most there can be. */
export function addEnergy(e: Energy, points: number, now: number): void {
  refreshEnergy(e, now);
  e.n = Math.min(ENERGY_MAX, e.n + Math.max(0, Math.floor(points)));
  if (e.n >= ENERGY_MAX) e.at = now;
}

/** Whole seconds until the next point comes back (0 when the energy is full). */
export function secondsToNext(e: Energy, now: number): number {
  refreshEnergy(e, now);
  if (e.n >= ENERGY_MAX) return 0;
  return Math.max(0, Math.ceil((e.at + ENERGY_REGEN_SECONDS * 1000 - now) / 1000));
}

/** Seconds as m:ss. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const KEY = "p10-energy";

/** The energy kept in the browser (full the first time, and if what is kept makes no sense). */
export function loadEnergy(now: number): Energy {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (typeof data === "object" && data !== null) {
      const {n, at} = data as Record<string, unknown>;
      if (typeof n === "number" && Number.isFinite(n) && typeof at === "number" && Number.isFinite(at)) {
        const e: Energy = {n: Math.min(ENERGY_MAX, Math.max(0, Math.floor(n))), at};
        refreshEnergy(e, now);
        return e;
      }
    }
  } catch {
    /* nothing kept, or private mode */
  }
  return createEnergy(now);
}

export function saveEnergy(e: Energy): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({n: e.n, at: e.at}));
  } catch {
    /* private mode */
  }
}
