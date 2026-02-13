import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { db } from "@/lib/db";
import { responses } from "@/lib/schema";
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
  const allResponses = await db.query.responses.findMany({
    where: (r, { eq }) => eq(r.surveyId, surveyId),
    with: { image: true },
  });
  return NextResponse.json(allResponses);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;
  ensureUploadsDir();

  const formData = await req.formData();
  const imageId = formData.get("imageId") as string;
  const participantId = formData.get("participantId") as string;
  const vote = parseInt(formData.get("vote") as string);
  const audio = formData.get("audio") as File | null;

  if (!imageId || !participantId) {
    return NextResponse.json({ error: "imageId and participantId are required" }, { status: 400 });
  }

  const responseId = uuid();
  let audioFilename: string | null = null;

  if (audio) {
    const ext = path.extname(audio.name) || ".webm";
    audioFilename = `response-${responseId}${ext}`;
    const buffer = Buffer.from(await audio.arrayBuffer());
    fs.writeFileSync(path.join(uploadsDir, audioFilename), buffer);
  }

  await db.insert(responses).values({
    id: responseId,
    imageId,
    surveyId,
    participantId,
    vote: isNaN(vote) ? null : vote,
    audioFilename,
    createdAt: new Date().toISOString(),
  });

  if (audioFilename) {
    after(() => transcribeAndSave(audioFilename, responseId, "responses"));
  }

  return NextResponse.json({ id: responseId }, { status: 201 });
}
