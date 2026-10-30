// Vensters openen: één fake terminal per proces, plus overlays (ransom-note, BSOD,
// rode flash) en de geluidsdaemon. Op Windows via PowerShell Start-Process, zodat
// elke terminal zijn eigen consolevenster krijgt.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const IS_WINDOWS = process.platform === 'win32';
export const ROOT = path.dirname(fileURLToPath(import.meta.url));
export const APP_DIR = path.resolve(ROOT, '..');

/** Plak waarin we de tijdelijke .cmd-bestanden schrijven. */
export function runDir() {
  return path.join(os.tmpdir(), 'fakevirus_run');
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Één fake terminalvenster openen.
 * @returns {import('node:child_process').ChildProcess|null}
 */
export function openTerminal({ role, id, terminalScript, appDir = APP_DIR, soundsDir }) {
  const dir = runDir();
  fs.mkdirSync(dir, { recursive: true });

  const cmdFile = path.join(dir, `term_${id}.cmd`);
  const args = [
    '--role', role,
    '--id', String(id),
  ];
  if (soundsDir) args.push('--sounds', soundsDir);
  args.push('--app', appDir);

  const argText = args
    .map((a) => {
      if (/^[A-Za-z0-9_.@:+-]+$/.test(a)) return a;
      return `"${a}"`;
    })
    .join(' ');

  fs.writeFileSync(
    cmdFile,
    [
      '@echo off',
      'chcp 65001 >nul 2>nul',
      'mode con: cols=104 lines=34 >nul 2>nul',
      `title FAKEVIRUS - ${role}`,
      `node "${terminalScript}" ${argText}`,
      '',
    ].join('\r\n'),
    'utf8',
  );

  if (IS_WINDOWS) {
    const command =
      `Start-Process -FilePath ${psQuote('cmd.exe')} -ArgumentList ${psQuote('/k')},${psQuote(cmdFile)}` +
      ` -WorkingDirectory ${psQuote(appDir)}`;
    return spawn('powershell.exe', ['-NoProfile', '-NoLogo', '-Command', command], {
      stdio: 'ignore',
      windowsHide: false,
    });
  }

  // Niet-Windows (ontwikkeling / tests): gewoon een bash-venster als het kan.
  const termEnv = ['x-terminal-emulator', 'gnome-terminal', 'konsole', 'xfce4-terminal'];
  for (const term of termEnv) {
    const probe = spawnSync('sh', ['-c', `command -v ${term}`], { stdio: 'ignore' });
    if (probe.status === 0) {
      return spawn(term, ['-e', 'bash', '-lc', `node "${terminalScript}" ${argText}`], {
        stdio: 'ignore',
        detached: true,
      });
    }
  }
  return spawn('bash', ['-lc', `node "${terminalScript}" ${argText}`], { stdio: 'ignore' });
}

/** Venster openen met een PowerShell overlay. */
export function openOverlay(script, args = []) {
  if (!IS_WINDOWS) return null;
  const file = path.resolve(APP_DIR, script);
  return spawn(
    'powershell.exe',
    ['-NoProfile', '-NoLogo', '-ExecutionPolicy', 'Bypass', '-File', file, ...args],
    { stdio: 'ignore', windowsHide: false },
  );
}

/** Verstopte PowerShell die op verzoek geluid afspeelt. */
export function startSoundDaemon(daemonScript) {
  if (!IS_WINDOWS) return null;
  const file = path.resolve(APP_DIR, daemonScript);
  return spawn(
    'powershell.exe',
    ['-NoProfile', '-NoLogo', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', file],
    { stdio: 'ignore', windowsHide: true },
  );
}

/** Alle fake terminals, overlays en de geluidsdaemon vervangen. */
export function killEngine() {
  const killed = [];
  if (IS_WINDOWS) {
    const script = [
      'Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |',
      '  Where-Object { $_.CommandLine -and $_.ProcessId -ne $PID -and ($_.CommandLine -like "*fakevirus*terminal.js*" -or $_.CommandLine -like "*fakevirus*app.js*" -or $_.CommandLine -like "*fakevirus_sounds*") } |',
      '  ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; "killed $($_.ProcessId)" } catch {} }',
    ].join(' ');
    const res = spawnSync('powershell.exe', ['-NoProfile', '-NoLogo', '-Command', script], {
      encoding: 'utf8',
      timeout: 20000,
    });
    killed.push((res.stdout || '').trim());
  }
  for (const child of tracked) {
    try {
      child.kill('SIGKILL');
    } catch {
      /* al weg */
    }
  }
  tracked.length = 0;
  return killed.filter(Boolean).join('\n');
}

/** Kinderen bijhouden voor opruimen op niet-Windows. */
const tracked = [];
export function track(child) {
  if (child) tracked.push(child);
  return child;
}

export function stopTracked() {
  for (const child of tracked) {
    try {
      child.kill('SIGKILL');
    } catch {
      /* al weg */
    }
  }
  tracked.length = 0;
}

/** Alleen de geopende terminals sluiten (overlays blijven staan). */
export function killTerminals() {
  if (!IS_WINDOWS) {
    stopTracked();
    return '';
  }
  const script = [
    'Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |',
      '  Where-Object { $_.CommandLine -and $_.ProcessId -ne $PID -and $_.CommandLine -like "*fakevirus*terminal.js*" } |',
    '  ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } catch {} }',
  ].join(' ');
  return spawnSync('powershell.exe', ['-NoProfile', '-NoLogo', '-Command', script], {
    encoding: 'utf8',
    timeout: 20000,
  }).stdout || '';
}
