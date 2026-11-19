/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Evidence } from "../../types/interactive";
import { bind, translate } from "../../i18n/translate.ts";
import { noteCount, outcomeLabelKey } from "./outcome.ts";
import {
  ANSWER_LABEL,
  CHANNEL_ANSWERS,
  CHANNEL_META,
  CHANNEL_PAN,
  FADE_S,
  MAX_GAIN,
  SPEAKER_CHANNELS,
  SPEAKER_HINTS,
  SPEAKER_LIMITATIONS,
  STOP_FADE_S,
  SWEEP_TO_HZ,
  TONE_DURATION_S,
  TONE_GAIN,
  TONE_NOTES_HZ,
  answeredCount,
  assessSpeakers,
  canFinishSpeakers,
  cancelledSpeakers,
  clamp,
  createTonePlayer,
  fadeFor,
  frequencySteps,
  gainEnvelope,
  isValidAnswer,
  panFor,
  safeGain,
  unavailableSpeakers,
  type AudioContextLike,
  type AudioInfo,
  type AudioNodeLike,
  type AudioParamLike,
  type SpeakerAnswers,
  type SpeakerOutput,
} from "./speaker.ts";

const tId = bind("id-ID");
const tEn = bind("en-US");
const text = (e: Evidence, lang: "id-ID" | "en-US" = "id-ID") => translate(lang, e.code, e.params);

// --- Helper murni ----------------------------------------------------------------

test("clamp, gain aman, dan posisi pan per kanal", () => {
  assert.equal(clamp(5, 0, 1), 1);
  assert.equal(clamp(-5, 0, 1), 0);
  assert.equal(clamp(0.5, 0, 1), 0.5);
  assert.equal(clamp(Number.NaN, 0, 1), 0, "NaN → batas bawah");
  assert.equal(panFor("left"), -1);
  assert.equal(panFor("right"), 1);
  assert.equal(panFor("stereo"), 0);
  assert.deepEqual(CHANNEL_PAN, { left: -1, right: 1, stereo: 0 });
  assert.equal(MAX_GAIN, 0.1);
  assert.equal(safeGain(0.5), MAX_GAIN, "tidak pernah di atas batas");
  assert.equal(safeGain(MAX_GAIN), MAX_GAIN);
  assert.equal(safeGain(-1), 0);
  assert.equal(safeGain(Number.NaN), 0, "NaN = senyap");
  assert.ok(TONE_GAIN >= 0.06 && TONE_GAIN <= 0.1, "gain rendah ≈ 0,06–0,1");
  assert.equal(safeGain(TONE_GAIN), TONE_GAIN);
});

test("nada uji ±2 detik: urutan nada lalu sapuan naik", () => {
  assert.ok(Math.abs(TONE_DURATION_S - 2) < 1e-9, `durasi ${TONE_DURATION_S}`);
  const steps = frequencySteps(10);
  assert.deepEqual(steps[0], { kind: "set", value: TONE_NOTES_HZ[0], time: 10 });
  const last = steps[steps.length - 1];
  assert.equal(last.kind, "exponential");
  assert.equal(last.value, SWEEP_TO_HZ);
  assert.ok(Math.abs(last.time - (10 + TONE_DURATION_S)) < 1e-9);
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i].time >= steps[i - 1].time, "waktu tidak mundur");
  assert.ok(steps.every((s) => s.value > 0), "ramp eksponensial butuh nilai > 0");
});

test("selubung gain: mulai dan berakhir senyap, fade dibatasi separuh durasi", () => {
  assert.equal(fadeFor(2), FADE_S);
  assert.equal(fadeFor(0.04), 0.02, "fade ≤ separuh durasi");
  assert.equal(fadeFor(0), 0);
  assert.equal(fadeFor(-1), 0);
  const env = gainEnvelope(5, 2, 0.08);
  assert.deepEqual(env[0], { kind: "set", value: 0, time: 5 });
  assert.equal(env[1].value, 0.08);
  assert.ok(Math.abs(env[1].time - (5 + FADE_S)) < 1e-9);
  assert.deepEqual(env[env.length - 1], { kind: "linear", value: 0, time: 7 });
  for (let i = 1; i < env.length; i++) assert.ok(env[i].time >= env[i - 1].time);
  assert.ok(gainEnvelope(0, 2, 5).every((s) => s.value <= MAX_GAIN), "gain dijepit");
});

// --- Pemutar dengan AudioContext palsu (KHUSUS TEST) -----------------------------

interface FakeNode extends AudioNodeLike {
  name: string;
  connectedTo: string[];
  disconnected: number;
}

function fakeParam(log: string[], name: string): AudioParamLike {
  const p: AudioParamLike = {
    value: 0,
    setValueAtTime: (v, t) => {
      log.push(`${name}.set(${v}@${t})`);
      p.value = v;
      return p;
    },
    linearRampToValueAtTime: (v, t) => log.push(`${name}.linear(${v}@${t})`),
    exponentialRampToValueAtTime: (v, t) => log.push(`${name}.exp(${v}@${t})`),
    cancelScheduledValues: (t) => log.push(`${name}.cancel(${t})`),
  };
  return p;
}

function fakeNode(name: string): FakeNode {
  const node: FakeNode = {
    name,
    connectedTo: [],
    disconnected: 0,
    connect: (dest) => node.connectedTo.push((dest as FakeNode).name),
    disconnect: () => {
      node.disconnected += 1;
    },
  };
  return node;
}

function fakeContext(opts: { state?: string; channels?: number } = {}) {
  const log: string[] = [];
  const nodes: FakeNode[] = [];
  let state = opts.state ?? "running";
  const make = (name: string) => {
    const n = fakeNode(`${name}${nodes.filter((x) => x.name.startsWith(name)).length}`);
    nodes.push(n);
    return n;
  };
  const ctx: AudioContextLike & { closed: number; resumed: number } = {
    closed: 0,
    resumed: 0,
    currentTime: 1,
    sampleRate: 48000,
    get state() {
      return state;
    },
    destination: { ...fakeNode("destination"), maxChannelCount: opts.channels ?? 2 },
    createOscillator: () => {
      const n = make("osc");
      return Object.assign(n, {
        type: "sine",
        frequency: fakeParam(log, `${n.name}.frequency`),
        start: (when?: number) => log.push(`${n.name}.start(${when})`),
        stop: (when?: number) => log.push(`${n.name}.stop(${when})`),
      });
    },
    createGain: () => {
      const n = make("gain");
      return Object.assign(n, { gain: fakeParam(log, `${n.name}.gain`) });
    },
    createStereoPanner: () => {
      const n = make("pan");
      return Object.assign(n, { pan: fakeParam(log, `${n.name}.pan`) });
    },
    resume: async () => {
      ctx.resumed += 1;
      state = "running";
    },
    close: async () => {
      ctx.closed += 1;
      state = "closed";
    },
  };
  return { ctx, log, nodes };
}

function fakeTimers() {
  const timers: { fn: () => void; ms: number; cleared: boolean }[] = [];
  return {
    timers,
    setTimer: (fn: () => void, ms: number) => {
      const t = { fn, ms, cleared: false };
      timers.push(t);
      return t;
    },
    clearTimer: (handle: unknown) => {
      (handle as { cleared: boolean }).cleared = true;
    },
    runAll: () => {
      for (const t of timers.splice(0)) if (!t.cleared) t.fn();
    },
  };
}

test("AudioContext tidak dibuat sampai play() (tidak ada autoplay)", async () => {
  let created = 0;
  const { ctx } = fakeContext();
  const player = createTonePlayer({
    createContext: () => {
      created += 1;
      return ctx;
    },
  });
  assert.equal(created, 0);
  assert.equal(player.playing(), null);
  player.stop(); // aman tanpa context
  await player.close();
  assert.equal(created, 0, "close tanpa play tidak membuat context");
});

test("play: context dibuat sekali, dilanjutkan bila suspended, rantai osc → gain → pan → speaker", async () => {
  const { ctx, log, nodes } = fakeContext({ state: "suspended" });
  const timers = fakeTimers();
  let created = 0;
  const player = createTonePlayer({
    createContext: () => {
      created += 1;
      return ctx;
    },
    ...timers,
  });
  const info: AudioInfo = await player.play("left");
  assert.deepEqual(info, { sampleRate: 48000, maxChannelCount: 2 });
  assert.equal(created, 1);
  assert.equal(ctx.resumed, 1);
  assert.equal(player.playing(), "left");
  const [osc, gain, pan] = nodes;
  assert.deepEqual(osc.connectedTo, ["gain0"]);
  assert.deepEqual(gain.connectedTo, ["pan0"]);
  assert.deepEqual(pan.connectedTo, ["destination"]);
  assert.equal((osc as unknown as { type: string }).type, "triangle");
  assert.equal((pan as unknown as { pan: AudioParamLike }).pan.value, -1);
  assert.ok(log.includes("gain0.gain.set(0@1.01)"), "gain mulai dari 0 (fade in)");
  assert.ok(log.includes(`gain0.gain.linear(${TONE_GAIN}@${1.01 + FADE_S})`));
  assert.ok(log.some((l) => l.startsWith("osc0.stop(")), "oscillator dijadwalkan berhenti");

  await player.play("right");
  assert.equal(created, 1, "context dipakai ulang");
  assert.equal(ctx.resumed, 1);
  assert.equal(player.playing(), "right");
  assert.equal((nodes[5] as unknown as { pan: AudioParamLike }).pan.value, 1);
  assert.ok(log.includes(`osc0.stop(${1 + STOP_FADE_S + 0.005})`), "nada sebelumnya dihentikan dengan fade singkat");
  assert.equal(osc.disconnected, 0, "diputus setelah fade selesai");
  timers.runAll();
  assert.equal(osc.disconnected, 1);
  assert.equal(gain.disconnected, 1);
  assert.equal(pan.disconnected, 1);
});

test("stop(): gain turun ke 0 lalu semua node diputus", async () => {
  const { ctx, log, nodes } = fakeContext();
  const timers = fakeTimers();
  const ended: string[] = [];
  const player = createTonePlayer({ createContext: () => ctx, onEnded: (c) => ended.push(c), ...timers });
  await player.play("stereo");
  assert.equal((nodes[2] as unknown as { pan: AudioParamLike }).pan.value, 0);
  player.stop();
  assert.equal(player.playing(), null);
  assert.ok(log.includes("gain0.gain.cancel(1)"));
  assert.ok(log.includes(`gain0.gain.linear(0@${1 + STOP_FADE_S})`), "fade singkat ke 0");
  timers.runAll();
  assert.ok(nodes.every((n) => n.disconnected === 1));
  assert.deepEqual(ended, [], "nada yang dihentikan tidak memicu onEnded");
});

test("nada selesai sendiri: onEnded dipanggil dan node diputus", async () => {
  const { ctx, nodes } = fakeContext();
  const timers = fakeTimers();
  const ended: string[] = [];
  const player = createTonePlayer({ createContext: () => ctx, onEnded: (c) => ended.push(c), ...timers });
  await player.play("right");
  assert.equal(timers.timers[0].ms, (TONE_DURATION_S + 0.1) * 1000);
  timers.runAll();
  assert.deepEqual(ended, ["right"]);
  assert.equal(player.playing(), null);
  assert.ok(nodes.every((n) => n.disconnected === 1));
});

test("close(): nada dihentikan, node diputus, context ditutup; play berikutnya membuat context baru", async () => {
  const first = fakeContext();
  const second = fakeContext();
  const contexts = [first.ctx, second.ctx];
  const timers = fakeTimers();
  const player = createTonePlayer({ createContext: () => contexts.shift()!, ...timers });
  await player.play("left");
  player.stop(); // node sedang fade-out
  await player.play("right");
  await player.close();
  assert.equal(first.ctx.closed, 1);
  assert.equal(player.playing(), null);
  assert.ok(first.nodes.every((n) => n.disconnected >= 1), "termasuk node yang sedang fade-out");
  assert.ok(timers.timers.filter((t) => t.ms > 1000).every((t) => t.cleared), "timer akhir nada dibatalkan");
  await player.close();
  assert.equal(first.ctx.closed, 1, "context yang sudah ditutup tidak ditutup ulang");
  await player.play("stereo");
  assert.equal(second.ctx.closed, 0);
  assert.equal(player.playing(), "stereo");
  await player.close();
  assert.equal(second.ctx.closed, 1);
});

test("close() selama resume: tidak ada nada yang diputar", async () => {
  const { ctx, nodes } = fakeContext({ state: "suspended" });
  const player = createTonePlayer({ createContext: () => ctx, ...fakeTimers() });
  const pending = player.play("left");
  await player.close();
  await pending;
  assert.equal(nodes.length, 0);
  assert.equal(player.playing(), null);
});

test("Web Audio tidak tersedia: play() gagal dengan error", async () => {
  const player = createTonePlayer({
    createContext: () => {
      throw new Error("tidak ada Web Audio");
    },
  });
  await assert.rejects(player.play("left"), /tidak ada Web Audio/);
  assert.equal(player.playing(), null);
});

// --- Jawaban dan penilaian -------------------------------------------------------

const AUDIO: AudioInfo = { sampleRate: 48000, maxChannelCount: 2 };
const ALL_CLEAR: SpeakerAnswers = { left: "clear", right: "clear", stereo: "clear" };
const assess = (answers: SpeakerAnswers, audio: AudioInfo | null = AUDIO, output?: SpeakerOutput) =>
  assessSpeakers({ answers, audio, output, durationMs: 900, finishedAt: "2026-11-19T10:00:00.000Z" });

test("jawaban: 'sisi yang salah' hanya untuk kiri/kanan; ketiga kanal wajib dijawab", () => {
  assert.ok(isValidAnswer("left", "wrongSide"));
  assert.ok(isValidAnswer("right", "wrongSide"));
  assert.equal(isValidAnswer("stereo", "wrongSide"), false);
  assert.equal(isValidAnswer("stereo", undefined), false);
  assert.equal(answeredCount({}), 0);
  assert.equal(answeredCount({ left: "clear", stereo: "wrongSide" }), 1);
  assert.equal(canFinishSpeakers({ left: "clear", right: "silent" }), false);
  assert.equal(canFinishSpeakers(ALL_CLEAR), true);
  assert.deepEqual(CHANNEL_ANSWERS.stereo, ["clear", "distorted", "silent"]);
});

test("semua jelas = Lulus (dikonfirmasi pengguna); info Web Audio terukur tetapi bukan 'ok'", () => {
  const r = assess(ALL_CLEAR);
  assert.equal(r.id, "speakers");
  assert.equal(r.outcome, "passed");
  assert.equal(outcomeLabelKey(r), "outcome.passedUserConfirmed");
  const path = r.evidence.find((e) => e.code === "speakerResult.audioPath")!;
  assert.equal(path.kind, "measured");
  assert.equal(path.level, "info");
  assert.equal(text(path), "Web Audio berjalan: 48000 Hz, 2 kanal keluaran (membuktikan jalur keluaran audio, bukan speakernya).");
  const confirmed = r.evidence.filter((e) => e.kind === "userConfirmed");
  assert.equal(confirmed.length, 3);
  assert.ok(confirmed.every((e) => e.level === "ok"));
  assert.equal(text(confirmed[0]), "Kiri: terdengar jelas.");
  assert.equal(text(confirmed[2], "en-US"), "Stereo (both): heard clearly.");
  assert.equal(tId(r.summaryCode, r.summaryParams), "Kiri, kanan, dan stereo terdengar jelas.");
  assert.deepEqual(r.limitations, SPEAKER_LIMITATIONS);
  assert.equal(r.durationMs, 900);
});

test("setiap jawaban selain 'jelas' = Gagal (kritis, dikonfirmasi pengguna)", () => {
  for (const channel of SPEAKER_CHANNELS) {
    for (const bad of CHANNEL_ANSWERS[channel].filter((a) => a !== "clear")) {
      const r = assess({ ...ALL_CLEAR, [channel]: bad });
      assert.equal(r.outcome, "failed", `${channel}:${bad}`);
      const critical = r.evidence.filter((e) => e.level === "critical");
      assert.equal(critical.length, 1);
      assert.equal(critical[0].kind, "userConfirmed");
    }
  }
  const r = assess({ left: "silent", right: "wrongSide", stereo: "distorted" });
  assert.equal(tId(r.summaryCode, r.summaryParams), "Masalah suara dilaporkan pada: Kiri, Kanan, Stereo (keduanya).");
  assert.equal(tEn(r.summaryCode, r.summaryParams), "Sound problems reported on: Left, Right, Stereo (both).");
  const texts = r.evidence.filter((e) => e.kind === "userConfirmed").map((e) => text(e, "en-US"));
  assert.deepEqual(texts, ["Left: not audible.", "Right: heard on the wrong side.", "Stereo (both): distorted or hissing."]);
});

test("kanal belum dijawab = Dibatalkan, bukan Lulus", () => {
  const r = assess({ left: "clear", stereo: "wrongSide" });
  assert.equal(r.outcome, "cancelled");
  assert.equal(tId(r.summaryCode, r.summaryParams), "Tes belum selesai: 1 dari 3 kanal dijawab.");
  assert.equal(assess({}, null).evidence.length, 0, "tanpa audio dan jawaban: tanpa bukti");
});

test("keluaran mono dan keluaran default (opsional) dicatat tanpa mengubah hasil", () => {
  const mono = assess(ALL_CLEAR, { sampleRate: 44100, maxChannelCount: 1 });
  const m = mono.evidence.find((e) => e.code === "speakerResult.mono")!;
  assert.equal(m.level, "info");
  assert.equal(text(m, "en-US"), "The audio output has only 1 channel(s); left/right cannot be separated.");
  assert.equal(mono.outcome, "passed");
  assert.ok(!assess(ALL_CLEAR).evidence.some((e) => e.code === "speakerResult.mono"));

  const external = assess(ALL_CLEAR, AUDIO, { defaultIsBuiltIn: false });
  assert.equal(external.evidence.find((e) => e.code === "speakerResult.notBuiltIn")!.level, "warning");
  assert.equal(noteCount(external), 1);
  const builtIn = assess(ALL_CLEAR, AUDIO, { defaultIsBuiltIn: true });
  assert.equal(builtIn.evidence.find((e) => e.code === "speakerResult.builtIn")!.level, "info");
  const unknown = assess(ALL_CLEAR, AUDIO, { defaultIsBuiltIn: null });
  assert.ok(!unknown.evidence.some((e) => e.code === "speakerResult.builtIn" || e.code === "speakerResult.notBuiltIn"));
  assert.ok(!assess(ALL_CLEAR).evidence.some((e) => e.code === "speakerResult.notBuiltIn"));
});

test("dibatalkan dan tidak tersedia tidak pernah dianggap lulus", () => {
  const c = cancelledSpeakers({ left: "clear", right: "clear" });
  assert.equal(c.outcome, "cancelled");
  assert.deepEqual(c.evidence, []);
  assert.equal(tEn(c.summaryCode, c.summaryParams), "Test not finished: 2 of 3 channels answered.");
  const u = unavailableSpeakers(10, "2026-11-19T10:00:00.000Z");
  assert.equal(u.outcome, "unavailable");
  assert.equal(u.durationMs, 10);
  assert.equal(u.evidence[0].level, "info");
  assert.equal(tId(u.summaryCode), "Tes speaker tidak bisa dijalankan di lingkungan ini.");
});

test("semua kunci teks speaker ada di dua bahasa", () => {
  const keys = [
    ...Object.values(CHANNEL_META).flatMap((m) => [m.name, m.hint]),
    ...Object.values(ANSWER_LABEL),
    ...SPEAKER_HINTS,
    ...SPEAKER_LIMITATIONS,
  ];
  for (const key of keys) {
    assert.notEqual(translate("id-ID", key), key, key);
    assert.notEqual(translate("en-US", key), key, key);
  }
});
