import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/lib/db";
import { pairwiseResponses } from "@/lib/schema";
import { transcribeAndSave } from "@/lib/transcribe";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs";

const uploadsDir = path.join(process.cwd(), "data", "uploads");

function ensureUploadsDir() {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;
  const all = await db
    .select()
    .from(pairwiseResponses)
    .where(eq(pairwiseResponses.surveyId, surveyId));
  return NextResponse.json(all);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;
  ensureUploadsDir();

  const formData = await req.formData();
  const participantId = formData.get("participantId") as string;
  const imageAId = formData.get("imageAId") as string;
  const imageBId = formData.get("imageBId") as string;
  const winnerId = (formData.get("winnerId") as string) || null;
  const scoreRaw = formData.get("score") as string | null;
  const score = scoreRaw !== null ? parseInt(scoreRaw, 10) : null;
  const audio = formData.get("audio") as File | null;

  if (!participantId || !imageAId || !imageBId) {
    return NextResponse.json(
      { error: "participantId, imageAId, and imageBId are required" },
      { status: 400 }
    );
  }

  const responseId = uuid();
  let audioFilename: string | null = null;

  if (audio) {
    const ext = path.extname(audio.name) || ".webm";
    audioFilename = `pairwise-${responseId}${ext}`;
    const buffer = Buffer.from(await audio.arrayBuffer());
    fs.writeFileSync(path.join(uploadsDir, audioFilename), buffer);
  }

  await db.insert(pairwiseResponses).values({
    id: responseId,
    surveyId,
    participantId,
    imageAId,
    imageBId,
    winnerId,
    score,
    audioFilename,
    createdAt: new Date().toISOString(),
  });

  if (audioFilename) {
    after(() => transcribeAndSave(audioFilename, responseId, "pairwiseResponses"));
  }

  return NextResponse.json({ id: responseId }, { status: 201 });
}
