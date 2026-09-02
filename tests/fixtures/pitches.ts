import type { PitchAgentRequest } from '../../lib/agent-handoff.ts';

export const PITCH_FIXTURES: Record<string, PitchAgentRequest> = {
  shelfSignal: {
    roomCode: 'A65120',
    roomUrl: 'https://pitchtheai.com/play?room=A65120',
    founderName: 'Avery Stone',
    companyName: 'ShelfSignal',
    askAmount: 600_000,
    equity: 8,
    difficulty: 'medium',
    pitch:
      'ShelfSignal turns ordinary store cameras into privacy-preserving inventory alerts for independent grocers. Twelve pilot stores cut out-of-stocks by 31% and food waste by 18%.',
  },
  clinicRelay: {
    roomCode: 'C11A1C',
    roomUrl: 'https://pitchtheai.com/play?room=C11A1C',
    founderName: 'Jordan Lee',
    companyName: 'ClinicRelay',
    askAmount: 1_200_000,
    equity: 10,
    difficulty: 'hard',
    pitch:
      'ClinicRelay gives independent practices a governed AI intake desk that converts calls, forms, and faxes into reviewable patient workflows.',
  },
  reefRoute: {
    roomCode: 'BEE123',
    roomUrl: 'https://pitchtheai.com/play?room=BEE123',
    founderName: 'Morgan Diaz',
    companyName: 'ReefRoute',
    askAmount: 250_000,
    equity: 0,
    difficulty: 'legendary',
    pitch:
      'ReefRoute is a WebMCP-first trip planner that lets a traveler and any compatible agent compare reef-safe operators using live availability and conservation receipts.',
  },
};
