import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/lib/db";
import { outroRecordings } from "@/lib/schema";
import { transcribeAndSave } from "@/lib/transcribe";
import { v4 as uuid } from "uuid";
import path from "path";
import fs from "fs";

const uploadsDir = path.join(process.cwd(), "data", "uploads");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;
  const recordings = await db.query.outroRecordings.findMany({
    where: (r, { eq }) => eq(r.surveyId, surveyId),
  });
  return NextResponse.json(recordings);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const formData = await req.formData();
  const participantId = formData.get("participantId") as string;
  const audio = formData.get("audio") as File | null;
  const transcription = formData.get("transcription") as string | null;

  if (!participantId || (!audio && !transcription)) {
    return NextResponse.json({ error: "participantId and audio or text are required" }, { status: 400 });
  }

  const id = uuid();
  let audioFilename = "";

  if (audio) {
    const ext = path.extname(audio.name) || ".webm";
    audioFilename = `outro-${id}${ext}`;
    const buffer = Buffer.from(await audio.arrayBuffer());
    fs.writeFileSync(path.join(uploadsDir, audioFilename), buffer);
  }

  await db.insert(outroRecordings).values({
    id,
    surveyId,
    participantId,
    audioFilename,
    transcription: transcription || null,
    createdAt: new Date().toISOString(),
  });

  if (audio) {
    after(() => transcribeAndSave(audioFilename, id, "outroRecordings"));
  }

  return NextResponse.json({ id }, { status: 201 });
}
