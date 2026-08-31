import { listLeaderboard, saveLeaderboardEntry } from '@/db/leaderboard';

export async function GET() {
  try {
    return Response.json({ entries: await listLeaderboard() });
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
      score: Number(body.score),
      amountRaised: Number(body.amountRaised),
      askAmount: Number(body.askAmount),
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
