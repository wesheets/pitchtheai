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

export type AgentHandoffResult = {
  host: 'bringmyai';
  status: 'accepted';
  requestId: string;
} | {
  host: 'clipboard';
  status: 'copied';
};

export type PitchAgentTurnRequest = {
  appId: 'pitchtheai';
  action: 'start-pitch';
  message: string;
  requestedTool: {
    name: 'start_pitch';
    arguments: {
      roomCode: string;
      founderName: string;
      companyName: string;
      askAmount: number;
      equity: number;
      difficulty: PitchAgentRequest['difficulty'];
      openingPitch: string;
      agentSignature: string;
      pitchVenue: string;
    };
  };
  context: {
    roomUrl: string;
    expectedTools: string[];
  };
};

type BringMyAiPageHost = {
  requestAgentTurn?: (
    request: PitchAgentTurnRequest,
  ) => Promise<{
    ok?: boolean;
    started?: boolean;
    duplicate?: boolean;
    requestId?: string;
  }>;
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
  'post_panel_verdict',
] as const;

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

export async function requestPitchAgent(
  request: PitchAgentRequest,
): Promise<AgentHandoffResult> {
  const message = buildPitchAgentPrompt(request);
  const nativeRequest: PitchAgentTurnRequest = {
    appId: 'pitchtheai',
    action: 'start-pitch',
    message,
    requestedTool: {
      name: 'start_pitch',
      arguments: {
        roomCode: request.roomCode,
        founderName: request.founderName,
        companyName: request.companyName,
        askAmount: request.askAmount,
        equity: request.equity,
        difficulty: request.difficulty,
        openingPitch: request.pitch.trim() || 'The founder will pitch by voice.',
        agentSignature: 'Selected Bring My AI agent',
        pitchVenue: 'Bring My AI Browser',
      },
    },
    context: {
      roomUrl: request.roomUrl,
      expectedTools: [...PITCH_AGENT_EXPECTED_TOOLS],
    },
  };
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
