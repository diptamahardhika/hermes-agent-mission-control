#!/usr/bin/env node
/**
 * Bridge watchdog — restarts the Hermes bridge if it's not running.
 * Intended to run via cron every 5 minutes.
 */
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const BRIDGE_DIR = path.resolve(import.meta.dirname, '..');
const BRIDGE_SCRIPT = path.join(BRIDGE_DIR, 'bridge.mjs');
const PID_FILE = path.join(BRIDGE_DIR, '.bridge.pid');
const LOG_FILE = path.join(BRIDGE_DIR, 'watchdog.log');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function isBridgeRunning() {
  try {
    if (fs.existsSync(PID_FILE)) {
      const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim(), 10);
      try {
        process.kill(pid, 0); // signal 0 = check existence without sending
        return true;
      } catch {
        return false;
      }
    }
  } catch {
    return false;
  }
  // Fallback: grep for the process
  try {
    const output = execSync('pgrep -f "node.*bridge.mjs"', { encoding: 'utf8' });
    return output.trim().length > 0;
  } catch {
    return false;
  }
}

function startBridge() {
  log('Starting bridge...');
  try {
    execSync(`node ${BRIDGE_SCRIPT} >> ${LOG_FILE} 2>&1 &`, { shell: true, detached: true });
    // Give it a moment to start and write its PID
    setTimeout(() => {
      try {
        const output = execSync('pgrep -f "node.*bridge.mjs"', { encoding: 'utf8' }).trim();
        if (output) {
          fs.writeFileSync(PID_FILE, output);
          log(`Bridge started with PID ${output}`);
        }
      } catch (e) {
        log('Failed to get bridge PID after start');
      }
    }, 2000);
  } catch (e) {
    log(`Failed to start bridge: ${e.message}`);
  }
}

function stopBridge() {
  log('Stopping bridge...');
  try {
    const output = execSync('pkill -f "node.*bridge.mjs"', { encoding: 'utf8' });
    log(`Killed: ${output.trim()}`);
  } catch {
    // Not running
  }
  if (fs.existsSync(PID_FILE)) {
    fs.unlinkSync(PID_FILE);
  }
}

function main() {
  log('Watchdog tick');
  if (!isBridgeRunning()) {
    log('Bridge not running — restarting');
    stopBridge();
    startBridge();
  } else {
    log('Bridge is running');
  }
}

main();
