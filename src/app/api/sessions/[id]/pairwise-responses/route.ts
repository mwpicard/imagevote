import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pairwiseResponses } from "@/lib/schema";
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
  const { id: sessionId } = await params;
  const all = await db
    .select()
    .from(pairwiseResponses)
    .where(eq(pairwiseResponses.sessionId, sessionId));
  return NextResponse.json(all);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  ensureUploadsDir();

  const formData = await req.formData();
  const participantId = formData.get("participantId") as string;
  const imageAId = formData.get("imageAId") as string;
  const imageBId = formData.get("imageBId") as string;
  const winnerId = formData.get("winnerId") as string;
  const audio = formData.get("audio") as File | null;

  if (!participantId || !imageAId || !imageBId || !winnerId) {
    return NextResponse.json(
      { error: "participantId, imageAId, imageBId, and winnerId are required" },
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
    sessionId,
    participantId,
    imageAId,
    imageBId,
    winnerId,
    audioFilename,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ id: responseId }, { status: 201 });
}
