// The daily challenge as it is kept in the browser: which day it was last tried, how far up the ladder it got, and whether it reached the top.
import {dayKey} from "../game/daily";

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
