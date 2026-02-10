import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { responses, pairwiseResponses, images, surveys } from "@/lib/schema";

type ImageRow = { id: string; filename: string; label: string | null };

/** Given pairwise win rows, return images with above-average wins. */
async function pairwiseFrontRunners(
  surveyId: string,
  participantId: string
): Promise<ImageRow[]> {
  const wins = await db
    .select({ winnerId: pairwiseResponses.winnerId })
    .from(pairwiseResponses)
    .where(
      and(
        eq(pairwiseResponses.surveyId, surveyId),
        eq(pairwiseResponses.participantId, participantId)
      )
    );

  if (wins.length === 0) return [];

  const winCounts: Record<string, number> = {};
  for (const w of wins) {
    if (w.winnerId) {
      winCounts[w.winnerId] = (winCounts[w.winnerId] || 0) + 1;
    }
  }

  const counts = Object.values(winCounts);
  const max = Math.max(...counts);
  const min = Math.min(...counts);

  // All images tied — no clear front runners
  if (max === min && counts.length > 1) return [];

  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
  const topIds = Object.entries(winCounts)
    .filter(([, count]) => count > avg)
    .map(([id]) => id);

  if (topIds.length === 0) return [];

  const allImages = await db
    .select({ id: images.id, filename: images.filename, label: images.label })
    .from(images)
    .where(eq(images.surveyId, surveyId));

  return allImages.filter((img) => topIds.includes(img.id));
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;
  const participantId = req.nextUrl.searchParams.get("participantId");

  if (!participantId) {
    return NextResponse.json({ error: "participantId is required" }, { status: 400 });
  }

  const survey = await db.query.surveys.findFirst({
    where: eq(surveys.id, surveyId),
  });

  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  const mode = survey.votingMode;

  if (mode === "binary" || mode === "guided_tour") {
    // Images where participant voted thumbs-up (vote = 1)
    const rows = await db
      .select({
        id: images.id,
        filename: images.filename,
        label: images.label,
      })
      .from(responses)
      .innerJoin(images, eq(responses.imageId, images.id))
      .where(
        and(
          eq(responses.surveyId, surveyId),
          eq(responses.participantId, participantId),
          eq(responses.vote, 1)
        )
      );

    // For guided tour, if no thumbs-up, fall back to pairwise Phase 2 front runners
    if (rows.length === 0 && mode === "guided_tour") {
      const frontRunners = await pairwiseFrontRunners(surveyId, participantId);
      return NextResponse.json({ favourites: frontRunners });
    }

    return NextResponse.json({ favourites: rows });
  }

  if (mode === "scale") {
    const allVotes = await db
      .select({
        id: images.id,
        filename: images.filename,
        label: images.label,
        vote: responses.vote,
      })
      .from(responses)
      .innerJoin(images, eq(responses.imageId, images.id))
      .where(
        and(
          eq(responses.surveyId, surveyId),
          eq(responses.participantId, participantId)
        )
      );

    if (allVotes.length === 0) {
      return NextResponse.json({ favourites: [] });
    }

    const maxVote = Math.max(...allVotes.map((r) => r.vote ?? 0));
    // Return images within 1 point of max — the clear front runners
    const favourites = allVotes
      .filter((r) => (r.vote ?? 0) >= maxVote - 1)
      .map(({ id, filename, label }) => ({ id, filename, label }));

    return NextResponse.json({ favourites });
  }

  if (mode === "pairwise") {
    const frontRunners = await pairwiseFrontRunners(surveyId, participantId);
    return NextResponse.json({ favourites: frontRunners });
  }

  return NextResponse.json({ favourites: [] });
}
