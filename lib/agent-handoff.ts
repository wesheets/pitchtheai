export type PitchAgentRequest = {
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
    };
  };
  context: {
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
    `Start the pitch for ${request.companyName} by calling start_pitch with founderName ${JSON.stringify(request.founderName)}, askAmount ${request.askAmount}, and equity ${request.equity}.`,
    `Opening pitch: ${pitchText}`,
    'Then role-play all four judges. Keep each personality distinct, update the visible arena after each founder answer, burn patience when the pitch falters, take judges out when warranted, and let interested judges compete with live bids when the evidence is strong.',
  ].join('\n\n');
}

export function hasBringMyAiAgentBridge() {
  return typeof window !== 'undefined' &&
    typeof window.bringMyAI?.requestAgentTurn === 'function';
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
        },
      },
      context: {
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
