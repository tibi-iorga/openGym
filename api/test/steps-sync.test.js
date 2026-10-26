// Real HTTP/file round trip with synthetic totals: a phone import and a stale desktop edit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { boundPort } from './helpers.mjs';
import { importStepDays } from '../../frontend/src/lib/steps.js';
import { mergeStates } from '../../frontend/src/lib/sync-merge.js';

test('phone daily totals survive server persistence and a conflicting desktop update', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-steps-'));
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(path.join(dataDir, 'secret'), secret);
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({
    users: [{ id: 'steps-test', name: 'Synthetic test', created: new Date().toISOString() }],
    creds: [], subs: [], invites: [],
  }));
  const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const child = spawn(process.execPath, ['server.js'], {
    cwd: apiDir, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN: 'http://localhost:8080', RP_ID: 'localhost' },
  });
  t.after(async () => {
    if (child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
  let log = '';
  child.stdout.on('data', chunk => { log += chunk; });
  child.stderr.on('data', chunk => { log += chunk; });
  const url = `http://127.0.0.1:${await boundPort(child, () => log)}/api/data`;
  const payload = `steps-test:${Date.now() + 86400000}:0`;
  const token = payload + '.' + crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  const put = async (state, baseRev) => {
    const response = await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ state, baseRev, stamped: true }) });
    return { status: response.status, body: await response.json() };
  };
  const get = async () => (await fetch(url, { headers })).json();
  const initial = { _ts: 100, unit: 'kg', workouts: [], routines: [], bodyweight: [], customEx: [], dailySteps: {} };
  const seed = await put(initial);
  assert.equal(seed.status, 200);
  const phone = { ...initial, _ts: 200, dailySteps: importStepDays({}, {
    days: [{ date: '2026-10-25', count: 0 }, { date: '2026-10-26', count: 4321 }],
    zone: 'Europe/Bucharest', readAt: 200,
  }) };
  const imported = await put(phone, seed.body.rev);
  assert.equal(imported.status, 200);
  const desktop = { ...initial, _ts: 300, theme: 'light' };
  const conflict = await put(desktop, seed.body.rev);
  assert.equal(conflict.status, 409);
  const current = await get();
  const merged = mergeStates(desktop, current.state);
  assert.equal((await put(merged, current.rev)).status, 200);
  const after = await get();
  assert.equal(after.state.dailySteps['2026-10-26'].count, 4321);
  assert.equal(after.state.dailySteps['2026-10-25'].count, 0);
  assert.equal(after.state.theme, 'light');
  const disk = JSON.parse(fs.readFileSync(path.join(dataDir, 'state-steps-test.json'), 'utf8'));
  assert.deepEqual(disk.dailySteps, after.state.dailySteps);
});
