import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { outroRecordings } from "@/lib/schema";
import { v4 as uuid } from "uuid";
import path from "path";
import fs from "fs";

const uploadsDir = path.join(process.cwd(), "data", "uploads");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const recordings = await db.query.outroRecordings.findMany({
    where: (r, { eq }) => eq(r.sessionId, sessionId),
  });
  return NextResponse.json(recordings);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const formData = await req.formData();
  const participantId = formData.get("participantId") as string;
  const audio = formData.get("audio") as File | null;

  if (!participantId || !audio) {
    return NextResponse.json({ error: "participantId and audio are required" }, { status: 400 });
  }

  const id = uuid();
  const ext = path.extname(audio.name) || ".webm";
  const audioFilename = `outro-${id}${ext}`;
  const buffer = Buffer.from(await audio.arrayBuffer());
  fs.writeFileSync(path.join(uploadsDir, audioFilename), buffer);

  await db.insert(outroRecordings).values({
    id,
    sessionId,
    participantId,
    audioFilename,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ id }, { status: 201 });
}
