export type PitchAgentRequest = {
  roomCode: string;
  founderName: string;
  companyName: string;
  askAmount: number;
  equity: number;
  pitch: string;
};

export type AgentHandoffResult =
  | { host: 'bringmyai'; status: 'requested' }
  | { host: 'codex'; status: 'copied' };

type BringMyAiRequest = {
  appId: 'pitchtheai';
  action: 'start_pitch';
  message: string;
  requestedTool: {
    name: 'start_pitch';
    arguments: {
      founderName: string;
      companyName: string;
      askAmount: number;
      equity: number;
      openingPitch: string;
    };
  };
  context: {
    roomCode: string;
    pitch: string;
    url: string;
    title: string;
  };
};

declare global {
  interface Window {
    bringMyAI?: {
      requestAgentTurn?: (request: BringMyAiRequest) => Promise<unknown>;
    };
  }
}

export function buildPitchAgentPrompt(request: PitchAgentRequest) {
  const pitchText = request.pitch.trim() || 'The founder will pitch by voice.';
  return [
    'Join the four-judge panel on the open Pitch The AI page.',
    `Target room code ${request.roomCode}. Before starting, call get_pitch_context and confirm its roomCode is exactly ${request.roomCode}. If it does not match, stop and report that the wrong Pitch The AI tab is attached.`,
    `Start the pitch for ${request.companyName} by calling start_pitch with founderName ${JSON.stringify(request.founderName)}, askAmount ${request.askAmount}, equity ${request.equity}, and the supplied opening pitch.`,
    `Opening pitch: ${pitchText}`,
    'Call get_pitch_context. If any evidence is pending, open and inspect every file and call review_pitch_evidence before bringing the judges in.',
    'Run a real conversation, not a four-answer monologue: call post_judge_turn for exactly one judge. When that judge asks a question, immediately call wait_for_founder_response in consecutive 12-second slices until the shared 45-second response gate returns answered or timed_out. If a slice returns waiting, call it again immediately and do not let another judge speak. Evaluate the exact returned answer before continuing. Never invent or skip the founder response.',
    'While the pitch is live, communicate only through Pitch The AI WebMCP tools. Do not narrate tool selection, repeat judge dialogue, summarize founder answers, or post routine progress updates in chat. The host may display normal WebMCP tool activity for the demo. Write in chat only if a tool fails, evidence cannot be opened, the founder answer cannot be recovered, or response latency exceeds 10 seconds. After the final verdict, provide one concise performance report.',
    'Keep each personality distinct. Every post_judge_turn must rate the immediately preceding founder answer with answerQuality (use unrated only before any answer) and select reactionStyle: neutral, laughing for something genuinely ridiculous, or exasperated for repetition, evasion, and silence. Specific, honest answers and evidence can improve the room. If the founder dodges the question, say “you never answered my question” or an equally direct personality-specific callout instead of politely moving on.',
    'When a judge leaves, use state out and provide a short, specific outReason; the arena will show a large I’M OUT exit. Repeated evasion or unanswered questions with no credible answer must score below 15, and an all-out performance that never answers the core questions must score 0–8. The final summary is a punchy, entertaining roast grounded in what happened, not a professional investment memo.',
    'Strongly interested judges may make offers with post_bid_round. Two or more judges should compete when the pitch genuinely earns it. After every offer round, immediately call wait_for_founder_offer_decision in consecutive 12-second slices. Never choose for the founder: they may accept a specific judge, counter that judge, or reject everyone. A counter may trigger another offer round. Only report money raised after the founder explicitly accepts an offer, and close with the exact accepted judge and amount.',
  ].join('\n\n');
}

export function hasBringMyAiAgentBridge() {
  return (
    typeof window !== 'undefined' &&
    typeof window.bringMyAI?.requestAgentTurn === 'function'
  );
}

export async function requestPitchAgent(
  request: PitchAgentRequest,
): Promise<AgentHandoffResult> {
  const message = buildPitchAgentPrompt(request);
  const bringMyAi = window.bringMyAI?.requestAgentTurn;
  if (typeof bringMyAi === 'function') {
    await bringMyAi({
      appId: 'pitchtheai',
      action: 'start_pitch',
      message,
      requestedTool: {
        name: 'start_pitch',
        arguments: {
          founderName: request.founderName,
          companyName: request.companyName,
          askAmount: request.askAmount,
          equity: request.equity,
          openingPitch: request.pitch.trim(),
        },
      },
      context: {
        roomCode: request.roomCode,
        pitch: request.pitch.trim(),
        url: window.location.href,
        title: document.title,
      },
    });
    return { host: 'bringmyai', status: 'requested' };
  }

  await navigator.clipboard.writeText(message);
  return { host: 'codex', status: 'copied' };
}
