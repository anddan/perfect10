// The tones of the light that can be put over the rooms (and over the menu bar and the pills at the top, which follow the tone that is chosen in the Looks):
// layers of colour, each with the way it is mixed with the picture under it.

export const TINTS: Record<string, [GlobalCompositeOperation, string][]> = {
  sunset: [["overlay", "rgba(255,128,48,0.6)"], ["source-over", "rgba(255,90,60,0.1)"]],
  night: [["multiply", "rgba(80,100,200,0.7)"], ["overlay", "rgba(40,60,170,0.4)"]],
  forest: [["overlay", "rgba(70,170,90,0.55)"], ["multiply", "rgba(160,225,170,0.3)"]],
  sepia: [["saturation", "rgba(128,128,128,1)"], ["multiply", "rgba(214,172,120,0.9)"]],
  ocean: [["overlay", "rgba(40,150,210,0.55)"], ["multiply", "rgba(150,205,240,0.35)"]],
  rose: [["overlay", "rgba(235,110,160,0.55)"], ["multiply", "rgba(250,200,220,0.3)"]],
  dawn: [["overlay", "rgba(255,170,130,0.4)"], ["screen", "rgba(150,120,210,0.2)"]],
  mono: [["saturation", "rgba(128,128,128,1)"]],
};

/** Puts the tone over what has been drawn in a rectangle (the caller has clipped to the shape it is for). Nothing is done for the natural tone. */
export function applyTint(ctx: CanvasRenderingContext2D, tint: string, x: number, y: number, w: number, h: number): void {
  const layers = TINTS[tint];
  if (!layers) return;
  ctx.save();
  for (const [op, color] of layers) {
    ctx.globalCompositeOperation = op;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}
