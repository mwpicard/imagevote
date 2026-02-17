import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { responses, pairwiseResponses, outroRecordings } from "@/lib/schema";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { isTranscriptionAvailable, transcribeAudioFile } from "@/lib/transcribe";
import { analyzeSentiment } from "@/lib/sentiment";

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

  // Sentiment pending: has transcription but no sentiment
  const sentimentPendingResponses = db
    .select()
    .from(responses)
    .where(
      and(
        eq(responses.surveyId, id),
        isNotNull(responses.transcription),
        isNull(responses.sentiment)
      )
    )
    .all();

  const sentimentPendingPairwise = db
    .select()
    .from(pairwiseResponses)
    .where(
      and(
        eq(pairwiseResponses.surveyId, id),
        isNotNull(pairwiseResponses.transcription),
        isNull(pairwiseResponses.sentiment)
      )
    )
    .all();

  const sentimentPendingOutro = db
    .select()
    .from(outroRecordings)
    .where(
      and(
        eq(outroRecordings.surveyId, id),
        isNotNull(outroRecordings.transcription),
        isNull(outroRecordings.sentiment)
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
    sentimentPending: {
      responses: sentimentPendingResponses.length,
      pairwise: sentimentPendingPairwise.length,
      outro: sentimentPendingOutro.length,
      total: sentimentPendingResponses.length + sentimentPendingPairwise.length + sentimentPendingOutro.length,
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
  let sentimentAnalyzed = 0;
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
      const sentiment = await analyzeSentiment(text);
      db.update(responses)
        .set({ transcription: text, sentiment })
        .where(eq(responses.id, r.id))
        .run();
      transcribed++;
      sentimentAnalyzed++;
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
      const sentiment = await analyzeSentiment(text);
      db.update(pairwiseResponses)
        .set({ transcription: text, sentiment })
        .where(eq(pairwiseResponses.id, r.id))
        .run();
      transcribed++;
      sentimentAnalyzed++;
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
      const sentiment = await analyzeSentiment(text);
      db.update(outroRecordings)
        .set({ transcription: text, sentiment })
        .where(eq(outroRecordings.id, r.id))
        .run();
      transcribed++;
      sentimentAnalyzed++;
    } catch (err) {
      errors.push({ file: r.audioFilename, error: (err as Error).message });
    }
  }

  // Analyze sentiment for records that have transcription but no sentiment
  const sentimentPendingR = db
    .select()
    .from(responses)
    .where(
      and(eq(responses.surveyId, id), isNotNull(responses.transcription), isNull(responses.sentiment))
    )
    .all();
  for (const r of sentimentPendingR) {
    try {
      const sentiment = await analyzeSentiment(r.transcription!);
      db.update(responses).set({ sentiment }).where(eq(responses.id, r.id)).run();
      sentimentAnalyzed++;
    } catch { /* skip */ }
  }

  const sentimentPendingP = db
    .select()
    .from(pairwiseResponses)
    .where(
      and(eq(pairwiseResponses.surveyId, id), isNotNull(pairwiseResponses.transcription), isNull(pairwiseResponses.sentiment))
    )
    .all();
  for (const r of sentimentPendingP) {
    try {
      const sentiment = await analyzeSentiment(r.transcription!);
      db.update(pairwiseResponses).set({ sentiment }).where(eq(pairwiseResponses.id, r.id)).run();
      sentimentAnalyzed++;
    } catch { /* skip */ }
  }

  const sentimentPendingO = db
    .select()
    .from(outroRecordings)
    .where(
      and(eq(outroRecordings.surveyId, id), isNotNull(outroRecordings.transcription), isNull(outroRecordings.sentiment))
    )
    .all();
  for (const r of sentimentPendingO) {
    try {
      const sentiment = await analyzeSentiment(r.transcription!);
      db.update(outroRecordings).set({ sentiment }).where(eq(outroRecordings.id, r.id)).run();
      sentimentAnalyzed++;
    } catch { /* skip */ }
  }

  return NextResponse.json({ transcribed, sentimentAnalyzed, errors });
}
