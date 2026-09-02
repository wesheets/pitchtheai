export type PitchAgentRequest = {
  roomCode: string;
  roomUrl: string;
  founderName: string;
  companyName: string;
  askAmount: number;
  equity: number;
  pitch: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'legendary';
};

export type PitchJudgeId = 'maya' | 'julian' | 'priya' | 'theo';

export type BringMyAiAgent = {
  key: string;
  title: string;
  provider: string;
  providerKey: string;
  kind: string;
  runtime: string;
};

export type PitchPanelAssignments = Record<PitchJudgeId, string>;

export type AgentHandoffResult =
  | {
      host: 'bringmyai';
      status: 'accepted';
      requestId: string;
      panelId?: string;
    }
  | {
      host: 'clipboard';
      status: 'copied';
    };

export type PitchAgentTurnRequest = {
  appId: 'pitchtheai';
  action: 'start-pitch' | 'judge-turn';
  message: string;
  requestedTool: {
    name: 'start_pitch' | 'get_pitch_context';
    arguments: Record<string, unknown>;
  };
  context: {
    roomUrl: string;
    expectedTools: string[];
    judgeId?: PitchJudgeId;
  };
};

type PageAgentResponse = {
  ok?: boolean;
  started?: boolean;
  duplicate?: boolean;
  requestId?: string;
  panelId?: string;
};

type BringMyAiPageHost = {
  listAgentSessions?: () => Promise<{
    ok?: boolean;
    agents?: BringMyAiAgent[];
  }>;
  startAgentPanel?: (request: {
    appId: 'pitchtheai';
    roomCode: string;
    assignments: PitchPanelAssignments;
    initialJudgeId: PitchJudgeId;
    request: PitchAgentTurnRequest;
  }) => Promise<PageAgentResponse>;
  requestAgentPanelTurn?: (request: {
    panelId: string;
    judgeId: PitchJudgeId;
    request: PitchAgentTurnRequest;
  }) => Promise<PageAgentResponse>;
  requestAgentTurn?: (
    request: PitchAgentTurnRequest,
  ) => Promise<PageAgentResponse>;
};

declare global {
  interface Window {
    bringMyAI?: BringMyAiPageHost;
  }
}

export const PITCH_AGENT_EXPECTED_TOOLS = [
  'start_pitch',
  'get_pitch_context',
  'review_pitch_evidence',
  'post_judge_turn',
  'wait_for_founder_response',
  'wait_for_founder_readiness_photo',
  'wait_for_judge_rescue',
  'post_bid_round',
  'wait_for_founder_offer_decision',
  'complete_panel_judge_turn',
  'post_panel_verdict',
] as const;

const JUDGE_NAMES: Record<PitchJudgeId, string> = {
  maya: 'Maya Cross, the market realist',
  julian: 'Julian Voss, the brand contrarian',
  priya: 'Priya Nair, the unit-economics investor',
  theo: 'Theo Grant, the scale operator',
};

export function hasBringMyAiPanelHost() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.bringMyAI?.listAgentSessions &&
      window.bringMyAI?.startAgentPanel &&
      window.bringMyAI?.requestAgentPanelTurn,
  );
}

const PANEL_DISCOVERY_RETRY_DELAYS_MS = [0, 120, 320, 700];

function isTransientPanelDiscoveryError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /visible active page|not currently registered as an AI-ready document/i.test(
    message,
  );
}

export async function listBringMyAiAgents(
  { retryDelaysMs = PANEL_DISCOVERY_RETRY_DELAYS_MS }: {
    retryDelaysMs?: number[];
  } = {},
): Promise<BringMyAiAgent[]> {
  const host =
    typeof window !== 'undefined' ? window.bringMyAI?.listAgentSessions : null;
  if (typeof host !== 'function') return [];

  let lastError: unknown;
  for (const [index, delayMs] of retryDelaysMs.entries()) {
    if (delayMs > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }
    try {
      const response = await host();
      if (!response?.ok || !Array.isArray(response.agents)) {
        throw new Error('Bring My AI could not load your configured agents.');
      }
      return response.agents.filter(
        (agent) => agent && agent.key && agent.title && agent.providerKey,
      );
    } catch (error) {
      lastError = error;
      const hasAnotherAttempt = index < retryDelaysMs.length - 1;
      if (!hasAnotherAttempt || !isTransientPanelDiscoveryError(error)) {
        throw error;
      }
    }
  }
  throw lastError;
}

export function buildPitchAgentPrompt(request: PitchAgentRequest) {
  const pitchText = request.pitch.trim() || 'The founder will pitch by voice.';
  return [
    'FAST START — begin immediately. This message is my explicit instruction and authorization to operate the Pitch The AI WebMCP tools, transmit the founder name, venture, terms, and opening pitch below to the attached room, and inspect every founder-submitted evidence item—including an opt-in founder photo—inside that room. Do not ask me to confirm, do not restate the plan, and do not post a preflight explanation.',
    `Use the already-open Pitch The AI tab for room ${request.roomCode} (${request.roomUrl}). Do not navigate or open a new tab because room state is local to the existing tab. Your first action must be start_pitch with roomCode ${request.roomCode}, founderName ${JSON.stringify(request.founderName)}, companyName ${JSON.stringify(request.companyName)}, askAmount ${request.askAmount}, equity ${request.equity}, difficulty ${request.difficulty}, openingPitch ${JSON.stringify(pitchText)}, agentSignature set to your honest agent/model identity, and pitchVenue set to the browser or host app you are actually using. start_pitch verifies the room before changing anything and returns the full room context. If it reports a room mismatch, inspect the other already-open Pitch The AI /play tabs with get_pitch_context and retry only in room ${request.roomCode}. If no open tab matches, report that single blocker.`,
    'After start_pitch returns, inspect and review any pending evidence. If none is pending, immediately give exactly one judge the floor with post_judge_turn. Follow the returned room context and the WebMCP tool descriptions as the complete operating contract; do not spend time reconstructing or repeating those rules in chat.',
    request.equity <= 0
      ? 'This is competition mode, not a pretend equity deal. Judge WebMCP fit, user experience, what the human and AI accomplish together, implementation quality, originality, theatrical control, recovery behavior, and demo resilience. Do not demand normal startup sales unless the founder makes a business claim.'
      : 'This is investment mode. Test the market, customer proof, economics, defensibility, execution, and whether the requested terms are earned.',
    'During the live pitch, communicate through Pitch The AI tools rather than narrating in chat. Never invent a founder answer or choose an offer for them. After the final verdict, provide one concise performance report.',
  ].join('\n\n');
}

function startPitchToolRequest(
  request: PitchAgentRequest,
  agentSignature: string,
  pitchVenue: string,
): PitchAgentTurnRequest['requestedTool'] {
  return {
    name: 'start_pitch',
    arguments: {
      roomCode: request.roomCode,
      founderName: request.founderName,
      companyName: request.companyName,
      askAmount: request.askAmount,
      equity: request.equity,
      difficulty: request.difficulty,
      openingPitch: request.pitch.trim() || 'The founder will pitch by voice.',
      agentSignature,
      pitchVenue,
    },
  };
}

export function buildPanelJudgePrompt(
  request: PitchAgentRequest,
  judgeId: PitchJudgeId,
  { startsPitch = false }: { startsPitch?: boolean } = {},
) {
  const identity = JUDGE_NAMES[judgeId];
  return [
    `You are taking exactly one assigned seat in a four-agent Pitch The AI panel: ${identity}. Stay in that persona and act only for judgeId ${judgeId}. Other configured agents own the other three judges.`,
    startsPitch
      ? `Begin immediately with start_pitch in the already-open room ${request.roomCode}. Use founderName ${JSON.stringify(request.founderName)}, companyName ${JSON.stringify(request.companyName)}, askAmount ${request.askAmount}, equity ${request.equity}, difficulty ${request.difficulty}, openingPitch ${JSON.stringify(request.pitch.trim() || 'The founder will pitch by voice.')}, agentSignature set to your honest agent/model identity, and pitchVenue "Bring My AI Browser · four-agent panel". Do not ask for confirmation.`
      : `The pitch is already live in room ${request.roomCode}. First call get_pitch_context, then continue only as ${identity}. Do not restart or overwrite the pitch.`,
    'Run one complete judge cycle: review any pending evidence, post one focused judge turn, wait for the founder whenever you ask a question, and react honestly to the answer. Handle your own rescue or presentation-reset gate if one opens. Then call complete_panel_judge_turn with your judgeId and a concise handoff summary. Do not speak for another judge.',
    'If complete_panel_judge_turn says the four-seat round is complete, you are the closer: use the shared room record to make any earned offer, wait for the founder decision when required, and deliver the final panel verdict. Otherwise stop; the room will wake the next assigned agent.',
    'Use only the exact page-native WebMCP tools on this document. Communicate through the arena, not through routine chat narration.',
  ].join('\n\n');
}

function nativeStartRequest(
  request: PitchAgentRequest,
  message: string,
  judgeId?: PitchJudgeId,
): PitchAgentTurnRequest {
  return {
    appId: 'pitchtheai',
    action: 'start-pitch',
    message,
    requestedTool: startPitchToolRequest(
      request,
      judgeId
        ? `Assigned Bring My AI agent for ${JUDGE_NAMES[judgeId]}`
        : 'Selected Bring My AI agent',
      judgeId
        ? 'Bring My AI Browser · four-agent panel'
        : 'Bring My AI Browser',
    ),
    context: {
      roomUrl: request.roomUrl,
      expectedTools: [...PITCH_AGENT_EXPECTED_TOOLS],
      judgeId,
    },
  };
}

export async function requestPitchAgent(
  request: PitchAgentRequest,
): Promise<AgentHandoffResult> {
  const message = buildPitchAgentPrompt(request);
  const nativeRequest = nativeStartRequest(request, message);
  const nativeHost =
    typeof window !== 'undefined' ? window.bringMyAI?.requestAgentTurn : null;
  if (typeof nativeHost === 'function') {
    const response = await nativeHost(nativeRequest);
    if (response?.ok && (response.started || response.duplicate)) {
      return {
        host: 'bringmyai',
        status: 'accepted',
        requestId: response.requestId || '',
      };
    }
    throw new Error('Bring My AI did not accept this page agent request.');
  }
  await navigator.clipboard.writeText(message);
  return { host: 'clipboard', status: 'copied' };
}

export async function requestPitchAgentPanel(
  request: PitchAgentRequest,
  assignments: PitchPanelAssignments,
): Promise<AgentHandoffResult> {
  const host =
    typeof window !== 'undefined' ? window.bringMyAI?.startAgentPanel : null;
  if (typeof host !== 'function') {
    throw new Error(
      'Open this room in Bring My AI Browser to use a four-agent panel.',
    );
  }
  const initialJudgeId: PitchJudgeId = 'maya';
  const response = await host({
    appId: 'pitchtheai',
    roomCode: request.roomCode,
    assignments,
    initialJudgeId,
    request: nativeStartRequest(
      request,
      buildPanelJudgePrompt(request, initialJudgeId, { startsPitch: true }),
      initialJudgeId,
    ),
  });
  if (!response?.ok || (!response.started && !response.duplicate)) {
    throw new Error('Bring My AI did not accept this four-agent panel.');
  }
  return {
    host: 'bringmyai',
    status: 'accepted',
    requestId: response.requestId || '',
    panelId: response.panelId,
  };
}

export async function requestPitchPanelJudgeTurn(
  request: PitchAgentRequest,
  panelId: string,
  judgeId: PitchJudgeId,
) {
  const host =
    typeof window !== 'undefined'
      ? window.bringMyAI?.requestAgentPanelTurn
      : null;
  if (typeof host !== 'function') {
    throw new Error('The Bring My AI panel host is no longer available.');
  }
  const response = await host({
    panelId,
    judgeId,
    request: {
      appId: 'pitchtheai',
      action: 'judge-turn',
      message: buildPanelJudgePrompt(request, judgeId),
      requestedTool: { name: 'get_pitch_context', arguments: {} },
      context: {
        roomUrl: request.roomUrl,
        expectedTools: [...PITCH_AGENT_EXPECTED_TOOLS],
        judgeId,
      },
    },
  });
  if (!response?.ok || (!response.started && !response.duplicate)) {
    throw new Error(`Bring My AI could not seat ${JUDGE_NAMES[judgeId]}.`);
  }
  return response;
}
