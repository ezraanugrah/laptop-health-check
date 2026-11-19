/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import { moveMenuIndex } from "./menu.ts";

test("navigasi menu: panah berputar, Home/End ke ujung, tombol lain diabaikan", () => {
  assert.equal(moveMenuIndex(0, "ArrowDown", 2), 1);
  assert.equal(moveMenuIndex(1, "ArrowDown", 2), 0);
  assert.equal(moveMenuIndex(0, "ArrowUp", 2), 1);
  assert.equal(moveMenuIndex(1, "Home", 2), 0);
  assert.equal(moveMenuIndex(0, "End", 2), 1);
  assert.equal(moveMenuIndex(0, "Enter", 2), null);
  assert.equal(moveMenuIndex(0, "a", 2), null);
  assert.equal(moveMenuIndex(0, "ArrowDown", 0), null);
});
