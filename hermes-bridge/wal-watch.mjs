// Pure helpers for watching the kanban DB's WAL sidecar.
//
// The kanban DB is in WAL mode, so committed writes can sit in the `-wal`
// sidecar until a checkpoint folds them into the main file. bridge.mjs takes
// its snapshot with SQLite's online backup, which reads *through* the WAL and
// is therefore correct either way — this watcher exists to make the WAL state
// observable, not to drive behaviour.
//
// Why it matters: plugins/kanban/dashboard/plugin_api.py `_EventTail` holds one
// long-lived SQLite connection per open dashboard socket (its docstring: "avoids
// churning WAL/SHM sidecars while an idle dashboard polls"). If that plugin is
// enabled, committed writes stay resident in the WAL, and any consumer that
// copied only the main DB file would silently miss them.
import { statSync } from "node:fs";

/**
 * Read the WAL sidecar's size without throwing when it is absent.
 * @param {string} walPath
 * @returns {number} byte size, or 0 when the file does not exist
 */
export function walSize(walPath) {
  // throwIfNoEntry:false measures ~4x cheaper than a throwing statSync
  // (0.75µs vs 2.98µs) and yields undefined instead of an exception.
  const st = statSync(walPath, { throwIfNoEntry: false });
  return st ? st.size : 0;
}

/**
 * Decide whether a WAL-size observation is worth logging.
 *
 * Only *transitions* are interesting. A non-empty WAL that stays non-empty is
 * one fact, not one line per tick — otherwise a resident writer turns the log
 * into a 5-second heartbeat. Returning the new state lets the caller log once
 * on the way in and once on the way back to empty.
 *
 * @param {number} prev non-zero if the previous observation was non-empty
 * @param {number} current size observed now
 * @returns {{log: boolean, prev: number, message: string|null}}
 */
export function walTransition(prev, current) {
  const wasOpen = prev > 0;
  const isOpen = current > 0;
  if (isOpen && !wasOpen) {
    return {
      log: true,
      prev: current,
      message: `kanban WAL non-empty (${current} bytes) — committed writes are checkpoint-pending; ensureTempKanbanDb reads through the WAL so snapshots stay correct`,
    };
  }
  if (!isOpen && wasOpen) {
    return {
      log: true,
      prev: 0,
      message: "kanban WAL back to empty (checkpointed or removed)",
    };
  }
  // No transition: stay quiet, but carry the size forward.
  return { log: false, prev: current, message: null };
}