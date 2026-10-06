// Tests for the kanban WAL watcher helpers.
// Run: node --test hermes-bridge/wal-watch.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { walSize, walTransition } from "./wal-watch.mjs";

test("walSize returns 0 when the WAL file is absent", () => {
  assert.equal(walSize("/tmp/definitely-not-a-real-wal-file"), 0);
});

test("walSize returns 0 for an empty WAL file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "waltest-"));
  const p = path.join(dir, "kanban.db-wal");
  fs.writeFileSync(p, "");
  assert.equal(walSize(p), 0);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("walSize returns the byte count for a non-empty WAL file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "waltest-"));
  const p = path.join(dir, "kanban.db-wal");
  const body = Buffer.alloc(24752, 1);
  fs.writeFileSync(p, body);
  assert.equal(walSize(p), 24752);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("walTransition is silent while the WAL stays empty", () => {
  const r = walTransition(0, 0);
  assert.equal(r.log, false);
  assert.equal(r.message, null);
  assert.equal(r.prev, 0);
});

test("walTransition logs once when the WAL goes non-empty", () => {
  const r = walTransition(0, 24752);
  assert.equal(r.log, true);
  assert.equal(r.prev, 24752);
  assert.match(r.message, /non-empty \(24752 bytes\)/);
});

test("walTransition stays quiet while the WAL remains non-empty (no heartbeat)", () => {
  // A resident writer would otherwise produce one log line per tick forever.
  const r = walTransition(24752, 30000);
  assert.equal(r.log, false);
  assert.equal(r.message, null);
  // ...but the size is carried forward so the eventual close is detected.
  assert.equal(r.prev, 30000);
});

test("walTransition logs once when the WAL returns to empty", () => {
  const r = walTransition(30000, 0);
  assert.equal(r.log, true);
  assert.equal(r.prev, 0);
  assert.match(r.message, /back to empty/);
});

test("walTransition treats a missing file as empty, so a close is detected", () => {
  // SQLite deletes the -wal on last-connection close; walSize() reports 0.
  const absent = walSize("/tmp/no-such-wal-xyz");
  const r = walTransition(4096, absent);
  assert.equal(r.log, true);
  assert.equal(r.prev, 0);
});

test("state machine: closed -> open -> open(bigger) -> closed logs exactly twice", () => {
  const msgs = [];
  let prev = 0;
  for (const size of [0, 0, 24752, 24752, 30000, 0, 0]) {
    const r = walTransition(prev, size);
    prev = r.prev;
    if (r.log) msgs.push(r.message);
  }
  assert.equal(msgs.length, 2, `expected 2 transitions, got ${msgs.length}`);
  assert.match(msgs[0], /non-empty/);
  assert.match(msgs[1], /back to empty/);
});