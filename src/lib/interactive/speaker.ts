// Tes Speaker (T5): nada uji Web Audio, pemutar, dan penilaian.
//
// Aturan: AudioContext hanya dibuat/dilanjutkan dari klik pengguna (tidak ada
// autoplay, tidak ada suara saat tes dibuka). Gain rendah dan tetap dengan fade
// in/out; volume sistem tidak dibaca atau diubah. Tes ini hanya memakai
// keluaran audio — tidak ada input/mikrofon. Pemutar menerima AudioContext
// lewat parameter agar bisa dites tanpa perangkat audio.
import type { UiKey } from "../../i18n/translate.ts";
import type { Evidence, InteractiveResult } from "../../types/interactive";
import { decideCompletedOutcome } from "./outcome.ts";

export type SpeakerChannel = "left" | "right" | "stereo";
export const SPEAKER_CHANNELS: SpeakerChannel[] = ["left", "right", "stereo"];

/** Posisi StereoPannerNode per kanal (-1 kiri … +1 kanan). */
export const CHANNEL_PAN: Record<SpeakerChannel, number> = { left: -1, right: 1, stereo: 0 };

export const CHANNEL_META: Record<SpeakerChannel, { name: UiKey; hint: UiKey }> = {
  left: { name: "speaker.channel.left", hint: "speaker.channelHint.left" },
  right: { name: "speaker.channel.right", hint: "speaker.channelHint.right" },
  stereo: { name: "speaker.channel.stereo", hint: "speaker.channelHint.stereo" },
};

/** Gain nada uji (≈ −22 dBFS): rendah dan tetap agar aman di volume sistem berapa pun. */
export const TONE_GAIN = 0.08;
/** Batas atas gain yang boleh dipakai pemutar. */
export const MAX_GAIN = 0.1;
/** Fade in/out nada agar tidak berbunyi "klik". */
export const FADE_S = 0.03;
/** Fade saat dihentikan manual. */
export const STOP_FADE_S = 0.02;
/** Urutan nada gelombang segitiga (C5–E5–G5–C6) … */
export const TONE_NOTES_HZ = [523.25, 659.25, 783.99, 1046.5];
export const NOTE_S = 0.35;
/** … lalu sapuan naik untuk memancing suara pecah/bergetar. */
export const SWEEP_FROM_HZ = 220;
export const SWEEP_TO_HZ = 3520;
export const SWEEP_S = 0.6;
/** Lama nada uji (detik) ≈ 2 s. */
export const TONE_DURATION_S = TONE_NOTES_HZ.length * NOTE_S + SWEEP_S;

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function panFor(channel: SpeakerChannel): number {
  return clamp(CHANNEL_PAN[channel], -1, 1);
}

/** Gain yang dipakai pemutar: dijepit ke [0, MAX_GAIN]; NaN → 0 (senyap). */
export function safeGain(gain: number): number {
  return clamp(gain, 0, MAX_GAIN);
}

/** Lama fade: tidak pernah lebih dari separuh durasi nada. */
export function fadeFor(duration: number, fade: number = FADE_S): number {
  return clamp(Math.min(fade, duration / 2), 0, Math.max(0, fade));
}

export interface ParamStep {
  kind: "set" | "linear" | "exponential";
  value: number;
  time: number;
}

/** Jadwal frekuensi nada uji mulai `start` (detik AudioContext). */
export function frequencySteps(start: number): ParamStep[] {
  const steps: ParamStep[] = TONE_NOTES_HZ.map((hz, i) => ({ kind: "set", value: hz, time: start + i * NOTE_S }));
  const sweepAt = start + TONE_NOTES_HZ.length * NOTE_S;
  steps.push({ kind: "set", value: SWEEP_FROM_HZ, time: sweepAt });
  steps.push({ kind: "exponential", value: SWEEP_TO_HZ, time: sweepAt + SWEEP_S });
  return steps;
}

/** Selubung gain: 0 → gain (fade in) … gain → 0 (fade out). */
export function gainEnvelope(start: number, duration: number, gain: number, fade: number = FADE_S): ParamStep[] {
  const g = safeGain(gain);
  const f = fadeFor(duration, fade);
  const end = start + Math.max(0, duration);
  return [
    { kind: "set", value: 0, time: start },
    { kind: "linear", value: g, time: start + f },
    { kind: "linear", value: g, time: end - f },
    { kind: "linear", value: 0, time: end },
  ];
}

// ---------------------------------------------------------------------------
// Pemutar (Web Audio disuntikkan)

export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
  exponentialRampToValueAtTime(value: number, time: number): unknown;
  cancelScheduledValues(time: number): unknown;
}
export interface AudioNodeLike {
  connect(destination: AudioNodeLike): unknown;
  disconnect(): void;
}
export interface OscillatorLike extends AudioNodeLike {
  type: string;
  frequency: AudioParamLike;
  start(when?: number): void;
  stop(when?: number): void;
}
export interface GainLike extends AudioNodeLike {
  gain: AudioParamLike;
}
export interface PannerLike extends AudioNodeLike {
  pan: AudioParamLike;
}
export interface AudioContextLike {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: string;
  readonly destination: AudioNodeLike & { readonly maxChannelCount: number };
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  createStereoPanner(): PannerLike;
  resume(): Promise<void>;
  close(): Promise<void>;
}

/** Data terukur dari Web Audio: membuktikan jalur keluaran, BUKAN speakernya. */
export interface AudioInfo {
  sampleRate: number;
  maxChannelCount: number;
}

export interface TonePlayerOptions {
  /** Dipanggil hanya dari `play()` (yang hanya dipanggil dari klik pengguna). */
  createContext: () => AudioContextLike;
  /** Nada selesai dengan sendirinya. */
  onEnded?: (channel: SpeakerChannel) => void;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  gain?: number;
}

export interface TonePlayer {
  /** Buat/lanjutkan AudioContext lalu putar nada di kanal itu (menghentikan nada sebelumnya). */
  play(channel: SpeakerChannel): Promise<AudioInfo>;
  /** Hentikan nada (fade singkat), lalu putuskan semua node. */
  stop(): void;
  /** Hentikan, putuskan node, dan tutup AudioContext. `play()` berikutnya membuat context baru. */
  close(): Promise<void>;
  playing(): SpeakerChannel | null;
}

interface Voice {
  channel: SpeakerChannel;
  osc: OscillatorLike;
  gain: GainLike;
  nodes: AudioNodeLike[];
  timer: unknown;
}

function applySteps(param: AudioParamLike, steps: ParamStep[]): void {
  for (const s of steps) {
    if (s.kind === "set") param.setValueAtTime(s.value, s.time);
    else if (s.kind === "linear") param.linearRampToValueAtTime(s.value, s.time);
    else param.exponentialRampToValueAtTime(s.value, s.time);
  }
}

function disconnectAll(nodes: AudioNodeLike[]): void {
  for (const node of nodes) {
    try {
      node.disconnect();
    } catch {
      // sudah terputus
    }
  }
}

export function createTonePlayer(options: TonePlayerOptions): TonePlayer {
  const setTimer = options.setTimer ?? ((fn: () => void, ms: number) => globalThis.setTimeout(fn, ms));
  const clearTimer =
    options.clearTimer ?? ((handle: unknown) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>));
  const gainValue = safeGain(options.gain ?? TONE_GAIN);
  let ctx: AudioContextLike | null = null;
  let voice: Voice | null = null;
  /** Node yang sedang fade-out setelah `stop()`; diputus oleh timer atau `close()`. */
  let fading: AudioNodeLike[][] = [];

  const infoOf = (c: AudioContextLike): AudioInfo => ({
    sampleRate: c.sampleRate,
    maxChannelCount: c.destination.maxChannelCount,
  });

  function stop(): void {
    const v = voice;
    voice = null;
    if (!v) return;
    clearTimer(v.timer);
    const now = ctx?.currentTime ?? 0;
    try {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(v.gain.gain.value, now);
      v.gain.gain.linearRampToValueAtTime(0, now + STOP_FADE_S);
      v.osc.stop(now + STOP_FADE_S + 0.005);
    } catch {
      // oscillator sudah berhenti
    }
    fading.push(v.nodes);
    setTimer(() => {
      fading = fading.filter((nodes) => nodes !== v.nodes);
      disconnectAll(v.nodes);
    }, (STOP_FADE_S + 0.03) * 1000);
  }

  async function play(channel: SpeakerChannel): Promise<AudioInfo> {
    stop();
    if (!ctx) ctx = options.createContext();
    const c = ctx;
    if (c.state === "suspended") await c.resume();
    // Ditutup selama menunggu: jangan memutar apa pun.
    if (ctx !== c) return infoOf(c);
    // Klik beruntun: hentikan nada yang mungkin dimulai selama menunggu.
    stop();

    const t0 = c.currentTime + 0.01;
    const osc = c.createOscillator();
    osc.type = "triangle";
    const gain = c.createGain();
    const panner = c.createStereoPanner();
    panner.pan.value = panFor(channel);
    panner.pan.setValueAtTime(panFor(channel), t0);
    applySteps(osc.frequency, frequencySteps(t0));
    applySteps(gain.gain, gainEnvelope(t0, TONE_DURATION_S, gainValue));
    osc.connect(gain);
    gain.connect(panner);
    panner.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + TONE_DURATION_S);

    const nodes: AudioNodeLike[] = [osc, gain, panner];
    const timer = setTimer(() => {
      if (voice?.osc !== osc) return;
      voice = null;
      disconnectAll(nodes);
      options.onEnded?.(channel);
    }, (TONE_DURATION_S + 0.1) * 1000);
    voice = { channel, osc, gain, nodes, timer };
    return infoOf(c);
  }

  async function close(): Promise<void> {
    const v = voice;
    voice = null;
    if (v) {
      clearTimer(v.timer);
      try {
        v.osc.stop();
      } catch {
        // sudah berhenti
      }
      disconnectAll(v.nodes);
    }
    for (const nodes of fading) disconnectAll(nodes);
    fading = [];
    const c = ctx;
    ctx = null;
    if (c && c.state !== "closed") {
      try {
        await c.close();
      } catch {
        // sudah ditutup
      }
    }
  }

  return { play, stop, close, playing: () => voice?.channel ?? null };
}

// ---------------------------------------------------------------------------
// Jawaban dan penilaian

/**
 * Jawaban pengguna per kanal:
 * - clear     : Jelas
 * - distorted : Pecah atau berdesis
 * - silent    : Tidak terdengar
 * - wrongSide : Terdengar di sisi yang salah (hanya kiri/kanan)
 */
export type ChannelAnswer = "clear" | "distorted" | "silent" | "wrongSide";
export type SpeakerAnswers = Partial<Record<SpeakerChannel, ChannelAnswer>>;

export const CHANNEL_ANSWERS: Record<SpeakerChannel, ChannelAnswer[]> = {
  left: ["clear", "distorted", "silent", "wrongSide"],
  right: ["clear", "distorted", "silent", "wrongSide"],
  stereo: ["clear", "distorted", "silent"],
};

export const ANSWER_LABEL: Record<ChannelAnswer, UiKey> = {
  clear: "speaker.answer.clear",
  distorted: "speaker.answer.distorted",
  silent: "speaker.answer.silent",
  wrongSide: "speaker.answer.wrongSide",
};

const ANSWER_RESULT: Record<ChannelAnswer, UiKey> = {
  clear: "speakerResult.clear",
  distorted: "speakerResult.distorted",
  silent: "speakerResult.silent",
  wrongSide: "speakerResult.wrongSide",
};

/** Petunjuk sebelum memutar nada (dilakukan pengguna sendiri; aplikasi tidak mengubah apa pun). */
export const SPEAKER_HINTS: UiKey[] = [
  "speakerHint.headphones",
  "speakerHint.volume",
  "speakerHint.noChange",
  "speakerHint.balance",
];

export const SPEAKER_LIMITATIONS: UiKey[] = [
  "speakerLimit.userConfirmed",
  "speakerLimit.outputPath",
  "speakerLimit.volume",
  "speakerLimit.drivers",
  "speakerLimit.settings",
];

/** Opsional (nanti dari backend): apakah keluaran default = speaker internal. */
export interface SpeakerOutput {
  defaultIsBuiltIn: boolean | null;
}

export function isValidAnswer(channel: SpeakerChannel, answer: ChannelAnswer | undefined): answer is ChannelAnswer {
  return answer !== undefined && CHANNEL_ANSWERS[channel].includes(answer);
}

export function answeredCount(answers: SpeakerAnswers): number {
  return SPEAKER_CHANNELS.filter((channel) => isValidAnswer(channel, answers[channel])).length;
}

/** Tes hanya bisa diselesaikan bila ketiga kanal sudah dijawab. */
export function canFinishSpeakers(answers: SpeakerAnswers): boolean {
  return answeredCount(answers) === SPEAKER_CHANNELS.length;
}

const channelParam = (channel: SpeakerChannel) => `@${CHANNEL_META[channel].name}`;

export interface SpeakerAnswer {
  answers: SpeakerAnswers;
  /** Info AudioContext dari pemutaran terakhir (null bila belum pernah berjalan). */
  audio: AudioInfo | null;
  output?: SpeakerOutput;
  durationMs: number;
  finishedAt: string;
}

export function assessSpeakers(answer: SpeakerAnswer): InteractiveResult {
  const evidence: Evidence[] = [];
  if (answer.audio) {
    // Terukur, tetapi hanya info: jalur keluaran ada, speaker belum tentu.
    evidence.push({
      kind: "measured",
      level: "info",
      code: "speakerResult.audioPath",
      params: { sampleRate: answer.audio.sampleRate, channels: answer.audio.maxChannelCount },
    });
    if (answer.audio.maxChannelCount < 2) {
      evidence.push({ kind: "measured", level: "info", code: "speakerResult.mono", params: { channels: answer.audio.maxChannelCount } });
    }
  }
  if (answer.output?.defaultIsBuiltIn === false) {
    evidence.push({ kind: "measured", level: "warning", code: "speakerResult.notBuiltIn" });
  } else if (answer.output?.defaultIsBuiltIn === true) {
    evidence.push({ kind: "measured", level: "info", code: "speakerResult.builtIn" });
  }

  const problems: SpeakerChannel[] = [];
  for (const channel of SPEAKER_CHANNELS) {
    const a = answer.answers[channel];
    if (!isValidAnswer(channel, a)) continue;
    if (a !== "clear") problems.push(channel);
    evidence.push({
      kind: "userConfirmed",
      level: a === "clear" ? "ok" : "critical",
      code: ANSWER_RESULT[a],
      params: { channel: channelParam(channel) },
    });
  }

  const base = {
    id: "speakers" as const,
    evidence,
    limitations: SPEAKER_LIMITATIONS,
    finishedAt: answer.finishedAt,
    durationMs: answer.durationMs,
  };
  if (!canFinishSpeakers(answer.answers)) {
    return {
      ...base,
      outcome: "cancelled",
      summaryCode: "speakerResult.cancelled",
      summaryParams: { answered: answeredCount(answer.answers), total: SPEAKER_CHANNELS.length },
    };
  }
  const outcome = decideCompletedOutcome(evidence);
  return outcome === "passed"
    ? { ...base, outcome, summaryCode: "speakerResult.passed" }
    : { ...base, outcome, summaryCode: "speakerResult.failed", summaryParams: { channels: problems.map(channelParam) } };
}

/** Keluar sebelum selesai: Dibatalkan (tidak pernah dianggap sehat). */
export function cancelledSpeakers(answers: SpeakerAnswers): InteractiveResult {
  return {
    id: "speakers",
    outcome: "cancelled",
    summaryCode: "speakerResult.cancelled",
    summaryParams: { answered: answeredCount(answers), total: SPEAKER_CHANNELS.length },
    evidence: [],
    limitations: SPEAKER_LIMITATIONS,
  };
}

/** Web Audio tidak tersedia/gagal dimulai: Tidak tersedia (bukan Gagal, bukan Lulus). */
export function unavailableSpeakers(durationMs?: number, finishedAt?: string): InteractiveResult {
  return {
    id: "speakers",
    outcome: "unavailable",
    summaryCode: "speakerResult.unavailable",
    evidence: [{ kind: "measured", level: "info", code: "speakerResult.audioFailed" }],
    limitations: SPEAKER_LIMITATIONS,
    finishedAt,
    durationMs,
  };
}
