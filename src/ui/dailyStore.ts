// The daily challenge as it is kept in the browser: which day it was last tried, how far up the ladder it got, and whether it reached the top.
import {type Streak, dayKey} from "../game/daily";

export interface DailyRecord {
  day: string;
  rungs: number;
  cleared: boolean;
}

const KEY = "p10-daily";

export function loadDaily(): DailyRecord | null {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (typeof data === "object" && data !== null) {
      const {day, rungs, cleared} = data as Record<string, unknown>;
      if (typeof day === "string" && typeof rungs === "number" && Number.isFinite(rungs)) return {day, rungs: Math.max(0, Math.floor(rungs)), cleared: cleared === true};
    }
  } catch {
    /* nothing kept, or private mode */
  }
  return null;
}

export function saveDaily(r: DailyRecord): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
    /* private mode */
  }
}

/** Today's try, if it has been made (the record of an earlier day does not count: the ladder is new every day). */
export function todaysTry(r: DailyRecord | null, day: string = dayKey()): DailyRecord | null {
  return r && r.day === day ? r : null;
}

const STREAK_KEY = "p10-streak";

/** The days in a row, as they were kept (nothing, if nothing has been kept or it cannot be read). */
export function loadStreak(): Streak | null {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(STREAK_KEY) ?? "null");
    if (typeof data === "object" && data !== null) {
      const {last, count, gift} = data as Record<string, unknown>;
      if (typeof last === "string" && typeof count === "number" && Number.isFinite(count) && count >= 1) return {last, count: Math.min(7, Math.floor(count)), gift: gift === true};
    }
  } catch {
    /* nothing kept, or private mode */
  }
  return null;
}

export function saveStreak(s: Streak): void {
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(s));
  } catch {
    /* private mode */
  }
}

const VIDEO_KEY = "p10-video-day";

/** The last day the video for coins was watched (nothing if it never was). */
export function loadVideoDay(): string | null {
  try {
    return localStorage.getItem(VIDEO_KEY);
  } catch {
    return null;
  }
}

export function saveVideoDay(day: string): void {
  try {
    localStorage.setItem(VIDEO_KEY, day);
  } catch {
    /* private mode */
  }
}

const GIFT_KEY = "p10-gift-day";

/** The last day the gift of the day was taken (it comes once a day). */
export function loadGiftDay(): string | null {
  try {
    return localStorage.getItem(GIFT_KEY);
  } catch {
    return null;
  }
}

export function saveGiftDay(day: string): void {
  try {
    localStorage.setItem(GIFT_KEY, day);
  } catch {
    /* private mode */
  }
}
