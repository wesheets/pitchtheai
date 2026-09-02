import assert from 'node:assert/strict';
import test from 'node:test';

import {
  PITCH_AGENT_EXPECTED_TOOLS,
  buildPitchAgentPrompt,
  requestPitchAgent,
  type PitchAgentTurnRequest,
} from '../lib/agent-handoff.ts';
import { PITCH_FIXTURES } from './fixtures/pitches.ts';

test('fixtures produce a room-bound fast-start prompt', () => {
  for (const fixture of Object.values(PITCH_FIXTURES)) {
    const prompt = buildPitchAgentPrompt(fixture);
    assert.match(prompt, /FAST START/);
    assert.match(prompt, new RegExp(`room ${fixture.roomCode}`));
    assert.match(prompt, /first action must be start_pitch/);
    assert.match(prompt, new RegExp(`askAmount ${fixture.askAmount}`));
    assert.match(prompt, new RegExp(`equity ${fixture.equity}`));
  }
});

test('native Bring My AI handoff receives the complete acceptance contract', async () => {
  const capturedRequests: PitchAgentTurnRequest[] = [];
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      bringMyAI: {
        requestAgentTurn: async (request: PitchAgentTurnRequest) => {
          capturedRequests.push(request);
          return {
            ok: true,
            started: true,
            requestId: 'page_agent_test_1',
          };
        },
      },
    },
  });

  const result = await requestPitchAgent(PITCH_FIXTURES.shelfSignal);

  assert.equal(result.host, 'bringmyai');
  assert.equal(result.status, 'accepted');
  assert.equal(capturedRequests.length, 1);
  const captured = capturedRequests[0];
  assert.equal(captured.appId, 'pitchtheai');
  assert.equal(captured.action, 'start-pitch');
  assert.equal(captured.requestedTool.name, 'start_pitch');
  assert.equal(captured.requestedTool.arguments.roomCode, 'A65120');
  assert.equal(captured.requestedTool.arguments.askAmount, 600_000);
  assert.equal(captured.requestedTool.arguments.equity, 8);
  assert.deepEqual(captured.context.expectedTools, [
    ...PITCH_AGENT_EXPECTED_TOOLS,
  ]);
  assert.match(captured.message, /ShelfSignal/);
});

test('a native host rejection is visible instead of silently copying', async () => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      bringMyAI: {
        requestAgentTurn: async () => ({ ok: false }),
      },
    },
  });

  await assert.rejects(
    requestPitchAgent(PITCH_FIXTURES.reefRoute),
    /did not accept this page agent request/,
  );
});

test('ordinary browsers retain the copy-and-paste fallback', async () => {
  let copied = '';
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {},
  });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        writeText: async (value: string) => {
          copied = value;
        },
      },
    },
  });

  const result = await requestPitchAgent(PITCH_FIXTURES.clinicRelay);

  assert.deepEqual(result, { host: 'clipboard', status: 'copied' });
  assert.match(copied, /ClinicRelay/);
  assert.match(copied, /room C11A1C/);
});
