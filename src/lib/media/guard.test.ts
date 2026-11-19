/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { LOCKED_MESSAGE, lockMediaDevices, mediaDevicesLocked, webGetUserMedia } from "./browser.ts";

const SRC = join(import.meta.dirname, "..", "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

test("getUserMedia/getDisplayMedia hanya muncul di src/lib/media (selain test)", () => {
  const offenders = sourceFiles(SRC)
    .filter((f) => !relative(SRC, f).startsWith(join("lib", "media")))
    .filter((f) => /getUserMedia|getDisplayMedia|mediaDevices/.test(readFileSync(f, "utf8")))
    .map((f) => relative(SRC, f));
  assert.deepEqual(offenders, []);
});

test("izin WebView tidak pernah dilonggarkan di frontend (tidak ada permissions.request)", () => {
  const offenders = sourceFiles(SRC)
    .filter((f) => /permissions\.request|requestPermission/.test(readFileSync(f, "utf8")))
    .map((f) => relative(SRC, f));
  assert.deepEqual(offenders, []);
});

test("lockMediaDevices: API global ditolak, fungsi asli hanya untuk modul media", async () => {
  // MediaDevices palsu KHUSUS TEST.
  const calls: string[] = [];
  const md = {
    getUserMedia: async (c: MediaStreamConstraints) => {
      calls.push(`asli:${JSON.stringify(c)}`);
      return { getTracks: () => [] } as unknown as MediaStream;
    },
    getDisplayMedia: async () => {
      calls.push("layar");
      return {} as MediaStream;
    },
  };
  assert.equal(lockMediaDevices(md), true);
  assert.equal(mediaDevicesLocked(), true);

  await assert.rejects(md.getUserMedia({ video: true }), (e: Error) => e.name === "NotAllowedError" && e.message === LOCKED_MESSAGE);
  await assert.rejects(md.getDisplayMedia(), (e: Error) => e.name === "NotAllowedError");
  assert.deepEqual(calls, [], "fungsi asli tidak terpanggil lewat API global");

  // Tidak bisa ditimpa kembali.
  assert.throws(() => {
    (md as { getUserMedia: unknown }).getUserMedia = async () => ({});
  });

  const original = webGetUserMedia();
  assert.ok(original);
  await original({ audio: true, video: false });
  assert.deepEqual(calls, ['asli:{"audio":true,"video":false}']);

  assert.equal(lockMediaDevices(md), true, "pemanggilan ulang aman");
});
