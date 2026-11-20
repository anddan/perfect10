import {it, expect} from "vitest";
import {createGame, FEATURES, startVariant, update, snakeTrain, SNAKE_GAP} from "./engine";
it("probe", () => {
  const g = createGame(() => 0.3);
  g.hideIntros = new Set(FEATURES);
  startVariant(g, "snake");
  g.countdown = 0;
  update(g, 1 / 60);
  const tr = snakeTrain(g);
  const bad = tr.map((n, i) => (i > 0 ? tr[i - 1].track! - n.track! : 54)).map((d, i) => (Math.abs(d - 54) > 0.6 ? `${i}:${d.toFixed(1)}@${tr[i].track!.toFixed(0)}` : "")).filter(Boolean);
  expect(bad.join(" ") + ` len ${tr.length}`).toBe("");
});
