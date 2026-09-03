#!/usr/bin/env node
/**
 * Bridge watchdog — reports status of the Hermes bridge.
 *
 * With launchd (ai.hermyhq.bridge) managing the bridge process, this script
 * acts as a read-only health reporter for the Hermes cron watchdog job.
 * It only attempts manual intervention if launchd is not managing the service.
 */
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const BRIDGE_DIR = path.resolve(import.meta.dirname, '..');
const PID_FILE = path.join(BRIDGE_DIR, '.bridge.pid');
const LOG_FILE = path.join(BRIDGE_DIR, 'watchdog.log');

const LAUNCHD_LABEL = 'ai.hermyhq.bridge';

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

/**
 * Check whether launchd is managing the bridge service.
 * Returns { managed: true,  running: bool } or { managed: false, running: bool }.
 */
function checkLaunchd() {
  try {
    const output = execSync(
      `launchctl list | grep '${LAUNCHD_LABEL}'`,
      { encoding: 'utf8' }
    );
    // launchctl list outputs: PID  Label  (empty PID means service exists but not running)
    const pid = output.trim().split(/\s+/)[0];
    const running = pid && pid !== '' && pid !== '0';
    return { managed: true, running };
  } catch {
    return { managed: false, running: false };
  }
}

/** Fallback: check via pgrep (for non-launchd installs). */
function isBridgeRunningFallback() {
  try {
    const output = execSync('pgrep -f "node.*bridge.mjs"', { encoding: 'utf8' });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

function main() {
  log('Watchdog tick');
  const ld = checkLaunchd();

  if (ld.managed) {
    if (ld.running) {
      log('Bridge is running (launchd)');
    } else {
      log('Bridge service registered but NOT running — launchd will restart it');
      // Write empty pidfile so downstream tools know launchd owns it
      try { fs.unlinkSync(PID_FILE); } catch {}
    }
  } else {
    // Not managed by launchd — fall back to manual check
    const procRunning = isBridgeRunningFallback();
    if (procRunning) {
      log('Bridge is running (manual)');
    } else {
      log('Bridge NOT running and not managed by launchd — manual restart recommended');
    }
  }
}

main();
