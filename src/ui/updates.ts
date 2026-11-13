// Picking up a new deploy without reinstalling: a game opened from a phone's home screen
// isn't reloaded when it's opened again, so it would keep running the old version. It checks
// version.json (written by every build) when it comes back to the front and every few minutes,
// and reloads when there is a newer build. A round that is being played is let finish first.
import {useEffect} from "react";

declare const __BUILD_ID__: string;

const EVERY_MS = 5 * 60 * 1000;

async function newerBuildOut(): Promise<boolean> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {cache: "no-store"});
    if (!res.ok) return false;
    const {id} = (await res.json()) as {id?: string};
    return !!id && id !== __BUILD_ID__;
  } catch {
    return false;
  }
}

/** Keeps the game up to date with the latest deploy (built game only; not while developing). */
export function useUpdates(canReload: () => boolean): void {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let busy = false;
    const check = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      const newer = await newerBuildOut();
      busy = false;
      if (newer && canReload()) location.reload();
    };
    void check();
    const id = setInterval(check, EVERY_MS);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
    };
  }, [canReload]);
}
