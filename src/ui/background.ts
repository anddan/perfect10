// The classroom behind the game, drawn once (and again if the screen changes size).
// A dimmed room: a wall with a blackboard, and the school desk the cups stand on.
import {DESK_Y, H, W} from "../game/constants";

/** A small steady random generator, so the wood grain looks the same every time. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wall(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createLinearGradient(0, 0, 0, DESK_Y);
  g.addColorStop(0, "#4b524f");
  g.addColorStop(1, "#383e3c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, DESK_Y);

  // Light from a window, falling in from the upper right.
  const light = ctx.createLinearGradient(W, 0, 0, DESK_Y * 0.8);
  light.addColorStop(0, "rgba(255,238,200,0.16)");
  light.addColorStop(1, "rgba(255,238,200,0)");
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, W, DESK_Y);

  // Wall trim.
  ctx.fillStyle = "#2c3230";
  ctx.fillRect(0, DESK_Y - 70, W, 5);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, DESK_Y - 65, W, 65);
}

function blackboard(ctx: CanvasRenderingContext2D): void {
  const x = 28;
  const y = 74;
  const w = W - 56;
  const h = 170;
  // Frame.
  ctx.fillStyle = "#5e4d3a";
  ctx.fillRect(x - 8, y - 8, w + 16, h + 16);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(x - 8, y + h + 4, w + 16, 4);
  // Board.
  const b = ctx.createLinearGradient(x, y, x + w, y + h);
  b.addColorStop(0, "#2f3d37");
  b.addColorStop(1, "#26322d");
  ctx.fillStyle = b;
  ctx.fillRect(x, y, w, h);
  // Chalk tray.
  ctx.fillStyle = "#4a3c2d";
  ctx.fillRect(x - 8, y + h + 8, w + 16, 7);
  ctx.fillStyle = "#cfc8b8";
  ctx.fillRect(x + 40, y + h + 4, 22, 4);
  // Faint chalk writing, half wiped away.
  ctx.fillStyle = "rgba(233,228,212,0.22)";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = '600 22px "Trebuchet MS","Segoe UI",system-ui,sans-serif';
  ctx.fillText("7 + 3 = 10", x + 20, y + 34);
  ctx.fillText("6 + 4 = 10", x + 60, y + 78);
  ctx.fillText("5 + 5 = 10", x + 28, y + 122);
  ctx.fillStyle = "rgba(233,228,212,0.10)";
  ctx.beginPath();
  ctx.ellipse(x + w * 0.7, y + h * 0.55, 70, 36, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

function desk(ctx: CanvasRenderingContext2D): void {
  const rnd = seeded(10);
  const g = ctx.createLinearGradient(0, DESK_Y, 0, H);
  g.addColorStop(0, "#7d6244");
  g.addColorStop(1, "#5f4730");
  ctx.fillStyle = g;
  ctx.fillRect(0, DESK_Y, W, H - DESK_Y);

  // Wood grain.
  for (let i = 0; i < 70; i++) {
    const y = DESK_Y + 4 + rnd() * (H - DESK_Y - 4);
    const x = rnd() * W;
    const len = 60 + rnd() * 200;
    ctx.strokeStyle = rnd() < 0.5 ? "rgba(0,0,0,0.10)" : "rgba(255,230,190,0.07)";
    ctx.lineWidth = 0.6 + rnd() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + len * 0.3, y + (rnd() - 0.5) * 3, x + len * 0.7, y + (rnd() - 0.5) * 3, x + len, y + (rnd() - 0.5) * 2);
    ctx.stroke();
  }

  // The far edge of the desk, catching the light.
  ctx.fillStyle = "rgba(255,236,200,0.22)";
  ctx.fillRect(0, DESK_Y, W, 2);
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.fillRect(0, DESK_Y - 3, W, 3);

  // A pencil groove, and a scratched-in ring from an old mug.
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.fillRect(0, DESK_Y + 16, W, 3);
  ctx.fillStyle = "rgba(255,236,200,0.10)";
  ctx.fillRect(0, DESK_Y + 19, W, 1);
  ctx.strokeStyle = "rgba(40,24,12,0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(300, DESK_Y + 52, 17, 0.4, 5.6);
  ctx.stroke();
}

function dim(ctx: CanvasRenderingContext2D): void {
  // The whole room is a little dimmed, darker at the corners.
  ctx.fillStyle = "rgba(10,8,18,0.22)";
  ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.25, W / 2, H * 0.55, H * 0.75);
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

/** The finished picture of the room, at `pxPerUnit` pixels for every game unit. */
export function makeBackground(pxPerUnit: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(W * pxPerUnit));
  c.height = Math.max(1, Math.round(H * pxPerUnit));
  const ctx = c.getContext("2d")!;
  ctx.scale(c.width / W, c.height / H);
  wall(ctx);
  blackboard(ctx);
  desk(ctx);
  dim(ctx);
  return c;
}
