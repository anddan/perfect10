// Small synthesized sounds (no files to load). Starts on the first touch, as browsers require.
// A few building blocks (a tone that can glide, a burst of filtered noise, a bell and a coffee "plop") are put together into the
// sound of everything that happens in the game. Everything goes through one compressor, so that sounds on top of each other do not clip.
import type {GameEvent} from "../game/types";

let ctx: AudioContext | null = null;
/** Where all the sounds go: a compressor, then the loudspeakers. */
let master: AudioNode | null = null;
let noiseBuf: AudioBuffer | null = null;
/**
 * The recorded sounds (in public/sounds): the drop of water when a number lands in the coffee, the press when a number is tapped,
 * the ice cracking and the hit on the steel number. Null until loaded (or if they cannot be loaded: the synthesized sounds are used then).
 */
let dropBuf: AudioBuffer | null = null;
let pressBuf: AudioBuffer | null = null;
let iceBuf: AudioBuffer | null = null;
let steelBuf: AudioBuffer | null = null;
/** The sound of a perfect 10 (a cup reaches 10) and of a cup dying (going over 10). */
let perfectBuf: AudioBuffer | null = null;
let cupDieBuf: AudioBuffer | null = null;
/** The tune of a level cleared with three stars, the tune of a level cleared with fewer, and the game over sound. */
let threeStarsBuf: AudioBuffer | null = null;
let clearedBuf: AudioBuffer | null = null;
let gameOverBuf: AudioBuffer | null = null;
/** The click of every button, and the sound of a page of the book being turned. */
let clickBuf: AudioBuffer | null = null;
let pageTurnBuf: AudioBuffer | null = null;
let muted = false;

/** The music in the background: quiet, loops, and has its own switch in the settings. */
const MUSIC_VOLUME = 0.128;

/** The songs, and which part of each loops (seconds: the slow start and the slow end are left out), how fast it plays and how loud it is. */
export type MusicTrack = "music" | "space" | "ambient1" | "ambient2" | "calm";
const TRACKS: Record<MusicTrack, {file: string; from: number; to: number; rate: number; gain: number}> = {
  music: {file: "music.mp3", from: 0, to: 0, rate: 0.9, gain: 1},
  // (the space chapter: from 32 seconds in to before its long fade at the end, 20% slower, and louder since it is a quiet recording)
  space: {file: "space-ambient.mp3", from: 32, to: 100, rate: 0.8, gain: 2.2},
  // (20% calmer than they are)
  ambient1: {file: "ambient1.mp3", from: 0.5, to: 94.5, rate: 0.9, gain: 0.8 * 0.73},
  ambient2: {file: "ambient2.mp3", from: 0.5, to: 107.5, rate: 0.9, gain: 0.8 * 1.3},
  calm: {file: "calm-ambient.mp3", from: 2, to: 119.5, rate: 0.9, gain: 1}, // (all but the space song play 10% slower)
};
/** The songs that have been loaded (null while one is loading, or if it could not be). */
const trackBufs: Partial<Record<MusicTrack, AudioBuffer | null>> = {};
/** The song that should play, and the one that does. */
let wantTrack: MusicTrack = "music";
let playingTrack: MusicTrack | null = null;
let musicGain: GainNode | null = null;
let musicSrc: AudioBufferSourceNode | null = null;
/** The volume of the song that plays (each song has its own, so that one can fade out while the next fades in). */
let musicSrcGain: GainNode | null = null;
/** The song that has been told to stop and is fading out. */
let fadingSrc: AudioBufferSourceNode | null = null;

function loadTrack(track: MusicTrack): void {
  if (!ctx || track in trackBufs) return;
  trackBufs[track] = null;
  void loadSample(ctx, TRACKS[track].file).then((b) => {
    trackBufs[track] = b;
    updateMusic();
  });
}

/** Which song plays in the round (a song that is already playing goes on if it is the same; another one fades over to the new one). */
export function setMusicTrack(track: MusicTrack): void {
  if (track === wantTrack) return;
  wantTrack = track;
  loadTrack(track);
  updateMusic();
}
let musicOn = true;
/** The volume of everything (sounds and music) in steps, 1 to VOLUME_STEPS, set with the buttons in the settings. Where everything ends up. */
export const VOLUME_STEPS = 5;
let volumeStep = VOLUME_STEPS;
let outGain: GainNode | null = null;
/** A round is going on (not the book/menu): the music plays only then, and goes on through the next level without starting over. */
let inRound = false;
/** The music is faded out for a moment (pause, level cleared, game over), and the volume it is heading for. */
let musicQuiet = false;
let musicLevel = 0;

try {
  muted = localStorage.getItem("p10-muted") === "1";
  musicOn = localStorage.getItem("p10-music") !== "0";
  const saved = Number(localStorage.getItem("p10-volume"));
  if (Number.isInteger(saved) && saved >= 1 && saved <= VOLUME_STEPS) volumeStep = saved;
} catch {
  /* private mode */
}

export function getVolumeStep(): number {
  return volumeStep;
}

/** One step louder (1) or quieter (-1); it stops at the ends. Returns the step it is on. */
export function stepVolume(direction: 1 | -1): number {
  volumeStep = Math.min(VOLUME_STEPS, Math.max(1, volumeStep + direction));
  try {
    localStorage.setItem("p10-volume", String(volumeStep));
  } catch {
    /* private mode */
  }
  if (ctx && outGain) outGain.gain.setTargetAtTime(volumeStep / VOLUME_STEPS, ctx.currentTime, 0.02);
  return volumeStep;
}

export function isMuted(): boolean {
  return muted;
}

export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem("p10-muted", muted ? "1" : "0");
  } catch {
    /* private mode */
  }
  updateMusic();
  return muted;
}

export function isMusicOn(): boolean {
  return musicOn;
}

export function toggleMusic(): boolean {
  musicOn = !musicOn;
  try {
    localStorage.setItem("p10-music", musicOn ? "1" : "0");
  } catch {
    /* private mode */
  }
  updateMusic();
  return musicOn;
}

/**
 * Tell the audio whether a round is on (true) or the book/menu is (false), and whether the music should be faded out for a moment
 * (the pause page, a level cleared, game over). A faded-out song keeps going silently, so it does not start over when it comes back.
 * Cheap to call every frame.
 */
export function setMusicScene(playing: boolean, quiet = false): void {
  if (playing === inRound && quiet === musicQuiet) return;
  inRound = playing;
  musicQuiet = quiet;
  updateMusic();
}

/**
 * Starts the music (fading in) when it should play, and fades it out and stops it when it should not (the music is off,
 * or no round is on). While a round is on it only moves the volume: down for a pause, a cleared level or game over, and up again after.
 */
function updateMusic(): void {
  if (!ctx || !musicGain) return;
  const buf = trackBufs[wantTrack] ?? null;
  // (the sound switch is for the sound effects only: the music has its own switch)
  const want = inRound && musicOn && buf !== null;
  const t = ctx.currentTime;
  const tr = TRACKS[wantTrack];
  const level = musicQuiet ? 0 : MUSIC_VOLUME * tr.gain;
  // Another song should play: the one that plays fades out, and the new one starts below.
  if (musicSrc && (!want || playingTrack !== wantTrack)) {
    const src = musicSrc;
    const g = musicSrcGain!;
    musicSrc = null;
    musicSrcGain = null;
    playingTrack = null;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    // Leaving the round for the book fades out slowly; turning the music off, or a new song, is quicker.
    const fadeOut = inRound ? 0.6 : 1.4;
    g.gain.linearRampToValueAtTime(0, t + fadeOut);
    src.stop(t + fadeOut + 0.05);
    if (fadingSrc) {
      try {
        fadingSrc.stop(t + fadeOut + 0.05);
      } catch {
        /* already stopped */
      }
    }
    fadingSrc = src;
  }
  if (want && !musicSrc && buf) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    if (tr.to > tr.from) {
      src.loopStart = tr.from;
      src.loopEnd = Math.min(tr.to, buf.duration);
    }
    src.playbackRate.value = tr.rate;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 2);
    src.connect(g).connect(musicGain);
    src.start(t, tr.from);
    musicSrc = src;
    musicSrcGain = g;
    playingTrack = wantTrack;
    musicLevel = level;
  } else if (want && musicSrc && musicSrcGain) {
    if (level === musicLevel) return;
    musicLevel = level;
    musicSrcGain.gain.cancelScheduledValues(t);
    musicSrcGain.gain.setValueAtTime(musicSrcGain.gain.value, t);
    musicSrcGain.gain.linearRampToValueAtTime(level, t + (level === 0 ? 0.8 : 1.2));
  }
}

/** Call from a touch or click. */
export function unlockAudio(): void {
  if (!ctx) {
    try {
      const AC = window.AudioContext ?? (window as unknown as {webkitAudioContext?: typeof AudioContext}).webkitAudioContext;
      if (AC) {
        ctx = new AC();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -16;
        comp.knee.value = 20;
        comp.ratio.value = 4;
        comp.attack.value = 0.003;
        comp.release.value = 0.2;
        const level = ctx.createGain();
        level.gain.value = 0.95;
        // Everything (sounds and music) goes through the volume of the settings before the loudspeakers.
        outGain = ctx.createGain();
        outGain.gain.value = volumeStep / VOLUME_STEPS;
        outGain.connect(ctx.destination);
        comp.connect(level).connect(outGain);
        master = comp;
        void loadSample(ctx, "drop.wav").then((b) => (dropBuf = b));
        void loadSample(ctx, "press.wav").then((b) => (pressBuf = b));
        void loadSample(ctx, "ice.wav").then((b) => (iceBuf = b));
        void loadSample(ctx, "steel.wav").then((b) => (steelBuf = b));
        void loadSample(ctx, "perfect10.mp3").then((b) => (perfectBuf = b));
        void loadSample(ctx, "cupdie.mp3").then((b) => (cupDieBuf = b));
        void loadSample(ctx, "complete1.mp3").then((b) => (threeStarsBuf = b));
        void loadSample(ctx, "complete2.mp3").then((b) => (clearedBuf = b));
        void loadSample(ctx, "gameover.mp3").then((b) => (gameOverBuf = b));
        void loadSample(ctx, "click.wav").then((b) => (clickBuf = b));
        void loadSample(ctx, "page-turn.mp3").then((b) => (pageTurnBuf = b));
        // The music has its own volume and does not go through the compressor of the sounds.
        musicGain = ctx.createGain();
        musicGain.gain.value = 1;
        musicGain.connect(outGain);
        loadTrack("music");
        loadTrack(wantTrack);
      }
    } catch {
      ctx = null;
      master = null;
    }
  }
  if (ctx && ctx.state === "suspended") void ctx.resume();
  updateMusic();
}

/** Fetches a recorded sound (public/sounds/<file>). If that does not work the synthesized sound is used instead (null). */
async function loadSample(c: AudioContext, file: string): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}sounds/${file}`);
    if (!res.ok) return null;
    return await c.decodeAudioData(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Plays a recorded sound, a little higher or lower if `rate` is not 1. `from` and `to` (seconds into the recording) play only a part
 * of it, so that the silence before a sound and the tail after it can be left out without changing the file; the end fades out over `fade` seconds.
 */
function sample(buf: AudioBuffer, vol: number, rate = 1, {from = 0, to = buf.duration, fade = 0}: {from?: number; to?: number; fade?: number} = {}): void {
  if (!ctx || !master || muted) return;
  const t = ctx.currentTime;
  const len = Math.max(0.01, Math.min(to, buf.duration) - from);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  if (fade > 0) {
    gain.gain.setValueAtTime(vol, t + Math.max(0, len / rate - fade));
    gain.gain.linearRampToValueAtTime(0, t + len / rate);
  }
  src.connect(gain).connect(master);
  src.start(t, from, len);
}

interface ToneOptions {
  type?: OscillatorType;
  /** How loud (the top of the sound). */
  vol?: number;
  /** The pitch the tone ends on, as a number of Hz added to the one it starts on (the older way: `to` is easier to read). */
  slide?: number;
  /** The pitch the tone glides to (Hz). */
  to?: number;
  /** Seconds the glide takes (the whole tone if left out): a short one makes a "bloop". */
  glide?: number;
  /** Seconds before it starts. */
  delay?: number;
  /** Seconds it takes to reach the top (short is a click, longer is soft). */
  attack?: number;
  /** Cuts the high notes off above this pitch (Hz), to make it softer and rounder. */
  lowpass?: number;
}

function tone(freq: number, dur: number, {type = "sine", vol = 0.15, slide = 0, to, glide, delay = 0, attack = 0.008, lowpass}: ToneOptions = {}): void {
  if (!ctx || !master || muted) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  const end = to ?? (slide ? freq + slide : 0);
  if (end > 0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + (glide ?? dur));
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node: AudioNode = osc;
  if (lowpass) {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = lowpass;
    osc.connect(filter);
    node = filter;
  }
  node.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

interface NoiseOptions {
  vol?: number;
  delay?: number;
  type?: BiquadFilterType;
  /** The pitch the filter sits at (Hz), and the pitch it sweeps to over the sound (if any). */
  freq?: number;
  to?: number;
  q?: number;
  attack?: number;
}

/** A burst of filtered noise: a splash, a whoosh, a crack, a click. */
function noise(dur: number, {vol = 0.1, delay = 0, type = "bandpass", freq = 1000, to, q = 0.8, attack = 0.005}: NoiseOptions = {}): void {
  if (!ctx || !master || muted) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(freq, t);
  if (to) filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.03);
}

/** A bell: the note, and two higher notes that do not fit it quite (that is what makes a bell sound like a bell), ringing out. */
function bell(freq: number, vol: number, delay = 0, dur = 0.5): void {
  tone(freq, dur, {vol, delay, attack: 0.004});
  tone(freq * 2.76, dur * 0.55, {vol: vol * 0.3, delay, attack: 0.004});
  tone(freq * 5.4, dur * 0.3, {vol: vol * 0.12, delay, attack: 0.004});
}

/**
 * The "plop" of a number dropping into the coffee: a bubble that shoots up in pitch and pops, a deeper "bloop" under it, and a
 * little splash. `pitch` makes it higher or lower (a drop a little different every time).
 */
function plop(pitch: number, vol: number, delay = 0): void {
  tone(340 * pitch, 0.16, {to: 960 * pitch, glide: 0.06, vol, delay, attack: 0.003});
  tone(180 * pitch, 0.22, {to: 85 * pitch, glide: 0.12, vol: vol * 0.8, delay: delay + 0.012, attack: 0.004});
  noise(0.1, {type: "bandpass", freq: 1500, to: 600, q: 0.7, vol: vol * 0.4, delay});
}

/** The click of a button (any button in the app). The recording (click.wav) is already cut: it starts on the click, with no silence before it. */
export function playClick(): void {
  if (clickBuf) sample(clickBuf, 0.6);
}

/** Something is bought with coins: a bright double chime and a little shower of coins. */
export function playBuy(): void {
  bell(1318.5, 0.1, 0, 0.35);
  bell(1760, 0.09, 0.07, 0.5);
  bell(2349.3, 0.06, 0.14, 0.5);
  noise(0.18, {type: "highpass", freq: 6500, vol: 0.04, delay: 0.05, attack: 0.01});
}

/** Coins come in (something was bought with money, or a video was watched): a quick rising run of bells, like coins pouring into a bowl. */
export function playGain(): void {
  [1046.5, 1318.5, 1568, 2093, 2637].forEach((f, i) => bell(f, 0.09, i * 0.06, 0.45));
  noise(0.3, {type: "highpass", freq: 6000, vol: 0.05, delay: 0.05, attack: 0.01});
}

/** A segment of the progress bar has faded away for good: three soft notes falling, and a dull crumble. */
export function playFadeGone(): void {
  [659.3, 523.3, 392].forEach((f, i) => tone(f, 0.32, {type: "triangle", vol: 0.13, delay: i * 0.1, to: f * 0.86, lowpass: 2400}));
  noise(0.35, {type: "bandpass", freq: 1800, to: 500, q: 0.9, vol: 0.07, delay: 0.02});
}

/** A page of the book being turned. */
export function playPageTurn(rate = 1): void {
  if (pageTurnBuf) sample(pageTurnBuf, 0.7, rate, {from: 0.012, to: 0.8, fade: 0.25});
}

/** Plays the sound that goes with something that happened in the game. */
export function playEvent(e: GameEvent): void {
  switch (e.t) {
    case "tap":
      // A number is pressed: the recorded press (a little higher or lower every time), or a soft synthesized "tok" that goes up.
      if (pressBuf) {
        sample(pressBuf, 0.6, 0.95 + Math.random() * 0.12);
      } else {
        tone(430, 0.1, {type: "triangle", to: 800, glide: 0.06, vol: 0.09, attack: 0.004});
        noise(0.03, {type: "highpass", freq: 3000, vol: 0.02});
      }
      break;
    case "ice":
      if (e.broke) {
        // The ice breaks: the recorded cracking (lower and heavier) with glass falling on top of it.
        if (iceBuf) sample(iceBuf, 0.85, 0.82 + Math.random() * 0.08);
        else noise(0.12, {type: "highpass", freq: 2500, vol: 0.12});
        [2300, 3100, 2700, 3700].forEach((f, i) => tone(f, 0.16, {vol: 0.04, delay: 0.03 + i * 0.03, attack: 0.002}));
      } else if (iceBuf) {
        // A crack in the ice: the recorded cracking.
        sample(iceBuf, 0.7, 1 + Math.random() * 0.12);
      } else {
        // (the synthesized crack: a short tick and a high note)
        noise(0.05, {type: "highpass", freq: 3500, vol: 0.09});
        tone(1900, 0.08, {type: "triangle", to: 1400, vol: 0.05, attack: 0.002});
      }
      break;
    case "sweep":
      // The screen rolls down with a long whoosh, and up again.
      noise(0.55, {type: "bandpass", freq: 300, to: 1800, q: 0.6, vol: 0.09, attack: 0.15});
      tone(200, 0.5, {type: "triangle", to: 120, vol: 0.04, attack: 0.1});
      noise(0.5, {type: "bandpass", freq: 1500, to: 280, q: 0.6, vol: 0.07, delay: 0.85, attack: 0.1});
      break;
    case "skull":
      // A skull pops: a quick hollow knock and a puff.
      tone(300, 0.1, {to: 160, glide: 0.08, vol: 0.22, attack: 0.002});
      noise(0.08, {type: "bandpass", freq: 1200, vol: 0.08});
      break;
    case "pop":
      // A number is rubbed out: a soft quick pop.
      tone(520, 0.08, {to: 900, glide: 0.06, vol: 0.18, attack: 0.003});
      noise(0.06, {type: "highpass", freq: 3000, vol: 0.05});
      break;
    case "steel":
      if (steelBuf) {
        // The hit on the steel number: the recorded ring (a little higher or lower every time).
        sample(steelBuf, 0.7, 0.96 + Math.random() * 0.1);
      } else {
        // (the synthesized clink: two high notes that ring a little, and a tick)
        noise(0.02, {type: "highpass", freq: 5000, vol: 0.06});
        tone(2350, 0.4, {vol: 0.1, to: 2300, attack: 0.002});
        tone(3520, 0.25, {vol: 0.06, delay: 0.005, attack: 0.002});
        tone(1180, 0.3, {type: "triangle", vol: 0.04, attack: 0.002});
      }
      break;
    case "combo": {
      // Higher and higher notes the longer the combo is.
      const base = 660 * Math.pow(2, (Math.min(e.n, 6) * 2) / 12);
      [0, 4, 7, 12].forEach((step, i) => bell(base * Math.pow(2, step / 12), 0.07, 0.25 + i * 0.06, 0.35));
      break;
    }
    case "land":
      // Into the coffee: the drop of water (a little higher or lower every time), or the synthesized plop if it has not been loaded.
      if (dropBuf) sample(dropBuf, 0.7, 0.92 + Math.random() * 0.2);
      else plop(0.9 + Math.random() * 0.25, 0.26);
      break;
    case "levelUp":
      if (perfectBuf) {
        // A perfect 10: the recorded sound (without the silence before it and its long tail).
        sample(perfectBuf, 0.9, 1, {from: 0.06, to: 0.95, fade: 0.25});
      } else {
        // (the synthesized one: a bright run of bells, with a sparkle on top)
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, 0.1, i * 0.08, 0.6));
        tone(2093, 0.4, {vol: 0.04, delay: 0.3, attack: 0.01});
        noise(0.35, {type: "highpass", freq: 6000, vol: 0.03, delay: 0.25, attack: 0.05});
      }
      break;
    case "revive":
      // A cup comes back: a soft rising shimmer.
      [523.25, 783.99, 1046.5].forEach((f, i) => bell(f, 0.08, 0.2 + i * 0.09, 0.5));
      tone(400, 0.35, {to: 900, vol: 0.05, delay: 0.2, attack: 0.05});
      break;
    case "bust":
      if (cupDieBuf) {
        // A cup dies: the recorded sound (without the silence before it and its long tail).
        sample(cupDieBuf, 0.9, 1, {from: 0.06, to: 0.75, fade: 0.2});
      } else {
        // (the synthesized one: a crack and a deflated "womp" going down)
        noise(0.08, {type: "highpass", freq: 1800, vol: 0.12});
        tone(230, 0.55, {type: "sawtooth", to: 75, vol: 0.12, lowpass: 700, attack: 0.01});
        tone(120, 0.4, {to: 50, vol: 0.18, attack: 0.005});
      }
      break;
    case "miss":
      // A number hits the desk: a soft thud.
      tone(160, 0.14, {to: 70, glide: 0.1, vol: 0.12, attack: 0.003});
      noise(0.05, {type: "lowpass", freq: 500, vol: 0.06});
      break;
    case "shield":
      if (e.on) {
        // A shield goes on: a soft rising shimmer.
        [659.25, 880, 1318.5].forEach((f, i) => bell(f, 0.07, i * 0.07, 0.4));
      } else {
        // The shield takes the hit: glass breaking.
        tone(900, 0.2, {to: 300, glide: 0.15, vol: 0.14, attack: 0.002});
        noise(0.3, {type: "highpass", freq: 3500, vol: 0.12, attack: 0.002});
      }
      break;
    case "zap":
      // The diamond: a rising electric whine and a bright chime.
      tone(200, 0.55, {type: "sawtooth", to: 1500, glide: 0.5, vol: 0.1, attack: 0.01, lowpass: 3500});
      noise(0.5, {type: "highpass", freq: 3500, vol: 0.05, attack: 0.02});
      [1046.5, 1318.5, 1568].forEach((f, i) => bell(f, 0.08, 0.05 + i * 0.07, 0.5));
      break;
    case "zapHit":
      // One number is changed: a crackle, and a chime too when it became a 10.
      noise(0.1, {type: "highpass", freq: 4500, vol: 0.08, attack: 0.002});
      tone(e.ten ? 880 : 320, 0.1, {type: "square", to: e.ten ? 1760 : 110, glide: 0.09, vol: 0.06, attack: 0.002, lowpass: 3000});
      if (e.ten) bell(1318.5, 0.1, 0.02, 0.5);
      break;
    case "laser":
      // The laser: a bright zap that falls fast, and a fizz.
      tone(1800, 0.32, {type: "sawtooth", to: 240, glide: 0.28, vol: 0.14, attack: 0.003, lowpass: 5000});
      noise(0.25, {type: "highpass", freq: 4000, vol: 0.05, attack: 0.003});
      break;
    case "blast":
      // The bomb: a deep boom and a crackle of noise.
      tone(110, 0.5, {to: 38, glide: 0.4, vol: 0.4, attack: 0.004});
      noise(0.45, {type: "lowpass", freq: 1800, to: 200, vol: 0.28, attack: 0.003});
      break;
    case "boom":
      // An explosion: a boom (deep and long for a big one) and a crackle.
      tone(e.big ? 100 : 180, e.big ? 0.6 : 0.22, {to: e.big ? 32 : 60, glide: e.big ? 0.5 : 0.18, vol: e.big ? 0.42 : 0.2, attack: 0.004});
      noise(e.big ? 0.55 : 0.2, {type: "lowpass", freq: 2000, to: 200, vol: e.big ? 0.3 : 0.14, attack: 0.003});
      break;
    case "comets":
      // Every comet pops: a crackling burst, and a bright chime on top.
      noise(0.4, {type: "highpass", freq: 2500, vol: 0.14, attack: 0.003});
      tone(220, 0.35, {to: 60, glide: 0.3, vol: 0.22, attack: 0.004});
      [1046.5, 1318.5, 1568].forEach((f, i) => bell(f, 0.07, 0.05 + i * 0.05, 0.4));
      break;
    case "weaponDown":
      // The weapons go down: a sputter that falls (lower and longer when it has no shots left).
      tone(e.empty ? 300 : 520, e.empty ? 0.45 : 0.22, {type: "square", to: e.empty ? 60 : 200, glide: e.empty ? 0.4 : 0.2, vol: 0.08, attack: 0.003, lowpass: 1800});
      noise(e.empty ? 0.35 : 0.15, {type: "lowpass", freq: 900, vol: 0.08, attack: 0.003});
      break;
    case "lineTick":
      // The last seconds: a tick, higher and louder the fewer are left.
      tone(e.s <= 3 ? 1200 : 880, 0.06, {vol: e.s <= 3 ? 0.16 : 0.1, attack: 0.002});
      break;
    case "lineStep":
      // The line takes in a tile: a soft click that goes up with every tile.
      // (a little brighter for every tile: a quarter of a tone up each time, for up to 24 tiles)
      tone(520 * Math.pow(2, Math.min(24, e.n - 1) / 24), 0.05, {vol: 0.08, attack: 0.002});
      break;
    case "magnet":
      // A magnet: a low hum that rises.
      tone(120, 0.4, {to: 360, glide: 0.35, vol: 0.14, attack: 0.02, type: "sawtooth", lowpass: 900});
      break;
    case "lineChain":
      // A chain in Draw to 10: a chord that goes higher with every step.
      [659.25, 783.99, 1046.5].forEach((f, i) => bell(f * Math.pow(1.122, Math.min(6, e.n)), 0.09, i * 0.05, 0.5));
      break;
    case "ghostShift":
      // A ghost changes: a soft wobble.
      tone(700, 0.15, {to: 500, glide: 0.12, vol: 0.06, attack: 0.01, type: "triangle"});
      break;
    case "guardHit":
      // A shot meets the shield: a soft ping.
      tone(1400, 0.05, {to: 1000, glide: 0.04, vol: 0.06, attack: 0.002});
      break;
    case "guardBreak":
      // The shield breaks: glass shatters.
      noise(0.35, {type: "highpass", freq: 3000, vol: 0.16, attack: 0.002});
      [1318.5, 1760, 2349.3].forEach((f, i) => bell(f, 0.05, i * 0.03, 0.25));
      break;
    case "mineDig":
      // A block is dug: a dull thud and a crumble.
      tone(160, 0.1, {to: 90, glide: 0.08, vol: 0.14, attack: 0.002});
      noise(0.12, {type: "lowpass", freq: 1200, vol: 0.08, attack: 0.002});
      break;
    case "ninjaCut":
      // A ball is cut: a swish and a juicy pop, higher for every ball of the stroke.
      noise(0.1, {type: "highpass", freq: 3000, vol: 0.1, attack: 0.002});
      tone(400 * Math.pow(1.12, Math.min(8, e.n - 1)), 0.12, {to: 900 * Math.pow(1.12, Math.min(8, e.n - 1)), glide: 0.1, vol: 0.12, attack: 0.002, type: "triangle"});
      break;
    case "ninjaToss":
      // A throw: a soft whoosh up.
      noise(0.18, {type: "bandpass", freq: 900, vol: 0.05, attack: 0.04});
      break;
    case "mineHeavy":
      // Too heavy: a dull clonk.
      tone(140, 0.12, {to: 110, glide: 0.1, vol: 0.14, attack: 0.002, type: "square", lowpass: 700});
      break;
    case "mineGate":
      // A gate opens: a lock that clicks open, and a fanfare.
      tone(900, 0.05, {vol: 0.1, attack: 0.002});
      [659.25, 830.61, 987.77, 1318.5].forEach((f, i) => bell(f, 0.1, 0.06 + i * 0.06, 0.55));
      break;
    case "mineGem":
      // A gem: a sparkling run up.
      [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(f, 0.07, i * 0.04, 0.4));
      break;
    case "mineErase":
      // The numbers are wiped out: a soft whoosh of a rubber.
      noise(0.45, {type: "bandpass", freq: 1800, vol: 0.1, attack: 0.05});
      break;
    case "mineRestore":
      // The numbers come back: a light sparkle up.
      [783.99, 1046.5, 1318.5].forEach((f, i) => bell(f, 0.06, i * 0.05, 0.35));
      break;
    case "mineTen":
      // A perfect 10 in the mine: a bright chord.
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f, 0.09, i * 0.05, 0.5));
      break;
    case "mineTip":
      // The basket tips over: a clatter that falls.
      tone(300, 0.3, {to: 80, glide: 0.25, vol: 0.12, attack: 0.003, type: "square", lowpass: 900});
      noise(0.3, {type: "lowpass", freq: 800, vol: 0.1, attack: 0.003});
      break;
    case "laserCross":
      // The laser of the cannon: a bright rising zap.
      tone(300, 0.35, {to: 1800, glide: 0.3, vol: 0.12, attack: 0.004, type: "sawtooth", lowpass: 4000});
      noise(0.25, {type: "highpass", freq: 4000, vol: 0.08, attack: 0.002});
      break;
    case "lineBolt":
      // A bolt: a crackling zap.
      noise(0.35, {type: "highpass", freq: 2500, vol: 0.16, attack: 0.002});
      tone(900, 0.3, {to: 120, glide: 0.28, vol: 0.1, attack: 0.002, type: "sawtooth", lowpass: 3000});
      break;
    case "lineTen":
      // A line makes 10: a bright chord that goes up.
      [659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => bell(f, 0.09, i * 0.05, 0.5));
      break;
    case "lineFail":
      // A line that is not 10: a short low buzz.
      tone(180, 0.18, {to: 120, glide: 0.15, vol: 0.12, attack: 0.003, type: "square", lowpass: 900});
      break;
    case "lineLevel":
      // A new level: a fanfare.
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => bell(f, 0.1, i * 0.07, 0.6));
      break;
    case "tenMade":
      // Balls make 10: a bright chord that goes up (higher with every step of a chain).
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => bell(f * Math.pow(1.122, Math.min(6, e.chain - 1)), 0.1, i * 0.05, 0.5));
      break;
    case "bubblePop":
      // A ball pops.
      tone(500 + e.v * 60, 0.08, {to: 1100 + e.v * 60, glide: 0.06, vol: 0.14, attack: 0.002});
      break;
    case "swarmDown":
      // The swarm comes down a row: a low thud.
      tone(110, 0.25, {to: 70, glide: 0.2, vol: 0.18, attack: 0.004});
      break;
    case "bombChain":
      // A fuse is lit: a quick fizz that rises.
      noise(0.2, {type: "highpass", freq: 3500, vol: 0.1, attack: 0.005});
      tone(600, 0.18, {to: 1200, glide: 0.16, vol: 0.08, attack: 0.005, type: "square", lowpass: 2500});
      break;
    case "snakeFaster":
      // The snake gets faster: a hiss that rises.
      noise(0.4, {type: "highpass", freq: 2500, vol: 0.12, attack: 0.02});
      tone(300, 0.35, {to: 700, glide: 0.3, vol: 0.12, attack: 0.01, type: "sawtooth", lowpass: 1600});
      break;
    case "hurt":
      // The ship loses a life: a hard thud.
      tone(140, 0.25, {to: 50, glide: 0.2, vol: 0.3, attack: 0.003});
      noise(0.15, {type: "highpass", freq: 1500, vol: 0.1, attack: 0.002});
      break;
    case "pickup":
      // The jet picks something up: a quick rising chime.
      [659.25, 987.77, 1318.5].forEach((f, i) => bell(f, 0.08, i * 0.05, 0.35));
      break;
    case "bonus":
      // A bonus ball: a bright chime that goes up.
      [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => bell(f, 0.09, i * 0.06, 0.45));
      noise(0.25, {type: "highpass", freq: 6000, vol: 0.025, delay: 0.1, attack: 0.04});
      break;
    case "won": {
      // A level is cleared: the recorded tune for three stars (complete1) or for fewer stars (complete2), or the synthesized fanfare
      // if the recording has not been loaded.
      const three = {buf: threeStarsBuf, vol: 0.5, from: 0.04, to: 3.5, fade: 0.4};
      const fewer = {buf: clearedBuf, vol: 1.4, from: 0.045, to: 1.15, fade: 0.35};
      const tune = e.stars === 3 ? three : fewer;
      if (tune.buf) {
        sample(tune.buf, tune.vol, 1, {from: tune.from, to: tune.to, fade: tune.fade});
        break;
      }
      // A fanfare: a run up, then a chord that rings.
      [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((f, i) => {
        tone(f, 0.3, {type: "triangle", vol: 0.12, delay: 0.1 + i * 0.1, attack: 0.01, lowpass: 3500});
        bell(f, 0.05, 0.1 + i * 0.1, 0.4);
      });
      [1046.5, 1318.5, 1568].forEach((f) => tone(f, 1.1, {type: "triangle", vol: 0.09, delay: 0.85, attack: 0.02, lowpass: 3500}));
      [1046.5, 1568].forEach((f) => bell(f, 0.07, 0.85, 1));
      break;
    }
    case "gameOver":
      if (gameOverBuf) {
        // The recorded game over sound (the tail that has gone quiet is left out).
        sample(gameOverBuf, 0.7, 1, {from: 0.015, to: 1.85, fade: 0.25});
      } else {
        // (the synthesized one: a sad falling tune, ending on a low note that fades)
        [392, 370, 330, 294].forEach((f, i) => tone(f, 0.4, {type: "triangle", vol: 0.13, delay: 0.3 + i * 0.2, attack: 0.02, lowpass: 1800}));
        tone(196, 1, {type: "sine", vol: 0.12, delay: 1.1, attack: 0.03});
      }
      break;
  }
}
