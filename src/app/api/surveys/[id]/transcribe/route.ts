import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { responses, pairwiseResponses, outroRecordings } from "@/lib/schema";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { isTranscriptionAvailable, transcribeAudioFile } from "@/lib/transcribe";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const available = isTranscriptionAvailable();

  const pendingResponses = db
    .select()
    .from(responses)
    .where(
      and(
        eq(responses.surveyId, id),
        isNotNull(responses.audioFilename),
        isNull(responses.transcription)
      )
    )
    .all();

  const pendingPairwise = db
    .select()
    .from(pairwiseResponses)
    .where(
      and(
        eq(pairwiseResponses.surveyId, id),
        isNotNull(pairwiseResponses.audioFilename),
        isNull(pairwiseResponses.transcription)
      )
    )
    .all();

  const pendingOutro = db
    .select()
    .from(outroRecordings)
    .where(
      and(
        eq(outroRecordings.surveyId, id),
        isNotNull(outroRecordings.audioFilename),
        isNull(outroRecordings.transcription)
      )
    )
    .all();

  return NextResponse.json({
    available,
    pending: {
      responses: pendingResponses.length,
      pairwise: pendingPairwise.length,
      outro: pendingOutro.length,
      total: pendingResponses.length + pendingPairwise.length + pendingOutro.length,
    },
  });
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!isTranscriptionAvailable()) {
    return NextResponse.json({ error: "OpenAI API key not configured" }, { status: 503 });
  }

  let transcribed = 0;
  const errors: { file: string; error: string }[] = [];

  // Transcribe responses
  const pendingResponses = db
    .select()
    .from(responses)
    .where(
      and(
        eq(responses.surveyId, id),
        isNotNull(responses.audioFilename),
        isNull(responses.transcription)
      )
    )
    .all();

  for (const r of pendingResponses) {
    try {
      const text = await transcribeAudioFile(r.audioFilename!);
      db.update(responses)
        .set({ transcription: text })
        .where(eq(responses.id, r.id))
        .run();
      transcribed++;
    } catch (err) {
      errors.push({ file: r.audioFilename!, error: (err as Error).message });
    }
  }

  // Transcribe pairwise responses
  const pendingPairwise = db
    .select()
    .from(pairwiseResponses)
    .where(
      and(
        eq(pairwiseResponses.surveyId, id),
        isNotNull(pairwiseResponses.audioFilename),
        isNull(pairwiseResponses.transcription)
      )
    )
    .all();

  for (const r of pendingPairwise) {
    try {
      const text = await transcribeAudioFile(r.audioFilename!);
      db.update(pairwiseResponses)
        .set({ transcription: text })
        .where(eq(pairwiseResponses.id, r.id))
        .run();
      transcribed++;
    } catch (err) {
      errors.push({ file: r.audioFilename!, error: (err as Error).message });
    }
  }

  // Transcribe outro recordings
  const pendingOutro = db
    .select()
    .from(outroRecordings)
    .where(
      and(
        eq(outroRecordings.surveyId, id),
        isNotNull(outroRecordings.audioFilename),
        isNull(outroRecordings.transcription)
      )
    )
    .all();

  for (const r of pendingOutro) {
    try {
      const text = await transcribeAudioFile(r.audioFilename);
      db.update(outroRecordings)
        .set({ transcription: text })
        .where(eq(outroRecordings.id, r.id))
        .run();
      transcribed++;
    } catch (err) {
      errors.push({ file: r.audioFilename, error: (err as Error).message });
    }
  }

  return NextResponse.json({ transcribed, errors });
}
