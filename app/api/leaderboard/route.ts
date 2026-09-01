import {
  getLeaderboardEntry,
  listLeaderboard,
  saveLeaderboardEntry,
  type StoredToolCall,
} from '@/db/leaderboard';

export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get('id');
    if (id) {
      const entry = await getLeaderboardEntry(id);
      return entry
        ? Response.json({ entry })
        : Response.json({ error: 'Pitch not found' }, { status: 404 });
    }
    const limit = Math.max(
      1,
      Math.min(
        100,
        Number(new URL(request.url).searchParams.get('limit')) || 20,
      ),
    );
    return Response.json({ entries: await listLeaderboard(limit) });
  } catch (error) {
    return Response.json(
      {
        entries: [],
        error:
          error instanceof Error ? error.message : 'Leaderboard unavailable',
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (
      typeof body.founderName !== 'string' ||
      typeof body.companyName !== 'string'
    ) {
      return Response.json(
        { error: 'Founder and company names are required.' },
        { status: 400 },
      );
    }
    const entry = await saveLeaderboardEntry({
      founderName: body.founderName,
      companyName: body.companyName,
      agentSignature:
        typeof body.agentSignature === 'string'
          ? body.agentSignature
          : 'Unspecified WebMCP agent',
      pitchVenue:
        typeof body.pitchVenue === 'string'
          ? body.pitchVenue
          : 'Attached WebMCP browser',
      score: Number(body.score),
      amountRaised: Number(body.amountRaised),
      askAmount: Number(body.askAmount),
      equity: Number(body.equity),
      durationSeconds: Number(body.durationSeconds) || 0,
      pauseSeconds: Number(body.pauseSeconds) || 0,
      difficulty:
        typeof body.difficulty === 'string' ? body.difficulty : 'medium',
      lifelinesUsed: Number(body.lifelinesUsed ?? 0),
      openingPitch:
        typeof body.openingPitch === 'string' ? body.openingPitch : '',
      transcript: typeof body.transcript === 'string' ? body.transcript : '',
      verdictSummary:
        typeof body.verdictSummary === 'string' ? body.verdictSummary : '',
      toolCalls: Array.isArray(body.toolCalls)
        ? (body.toolCalls as StoredToolCall[])
        : [],
      founderPhotoMaterialId:
        typeof body.founderPhotoMaterialId === 'string'
          ? body.founderPhotoMaterialId
          : undefined,
    });
    return Response.json({ entry }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Could not save leaderboard entry',
      },
      { status: 500 },
    );
  }
}
