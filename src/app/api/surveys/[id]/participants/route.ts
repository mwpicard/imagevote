import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { participants, responses, pairwiseResponses, outroRecordings, orderInterests } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import fs from "fs";
import path from "path";

const uploadsDir = path.join(process.cwd(), "data", "uploads");

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const all = await db
    .select()
    .from(participants)
    .where(eq(participants.surveyId, id));

  return NextResponse.json(all);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const firstName = body.firstName?.trim();
  if (!firstName) {
    return NextResponse.json(
      { error: "firstName is required" },
      { status: 400 }
    );
  }

  const participantId = uuid();

  const groupLabel = body.groupLabel?.trim() || null;
  const ndaAgreedAt = body.ndaAgreedAt || null;

  await db.insert(participants).values({
    id: participantId,
    surveyId: id,
    firstName,
    lastName: body.lastName?.trim() || null,
    age: body.age ? Number(body.age) : null,
    groupLabel,
    ndaAgreedAt,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json(
    { id: participantId, firstName, lastName: body.lastName?.trim() || null, age: body.age ? Number(body.age) : null, groupLabel, ndaAgreedAt },
    { status: 201 }
  );
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;
  const { searchParams } = new URL(req.url);
  const participantId = searchParams.get("participantId");

  if (!participantId) {
    return NextResponse.json(
      { error: "participantId query param is required" },
      { status: 400 }
    );
  }

  // Collect audio filenames to delete from disk
  const audioFiles: string[] = [];

  const respRows = await db
    .select({ audioFilename: responses.audioFilename })
    .from(responses)
    .where(and(eq(responses.surveyId, surveyId), eq(responses.participantId, participantId)));
  for (const r of respRows) {
    if (r.audioFilename) audioFiles.push(r.audioFilename);
  }

  const pairRows = await db
    .select({ audioFilename: pairwiseResponses.audioFilename })
    .from(pairwiseResponses)
    .where(and(eq(pairwiseResponses.surveyId, surveyId), eq(pairwiseResponses.participantId, participantId)));
  for (const r of pairRows) {
    if (r.audioFilename) audioFiles.push(r.audioFilename);
  }

  const outroRows = await db
    .select({ audioFilename: outroRecordings.audioFilename })
    .from(outroRecordings)
    .where(and(eq(outroRecordings.surveyId, surveyId), eq(outroRecordings.participantId, participantId)));
  for (const r of outroRows) {
    if (r.audioFilename) audioFiles.push(r.audioFilename);
  }

  // Delete DB rows
  await db.delete(responses).where(and(eq(responses.surveyId, surveyId), eq(responses.participantId, participantId)));
  await db.delete(pairwiseResponses).where(and(eq(pairwiseResponses.surveyId, surveyId), eq(pairwiseResponses.participantId, participantId)));
  await db.delete(outroRecordings).where(and(eq(outroRecordings.surveyId, surveyId), eq(outroRecordings.participantId, participantId)));
  await db.delete(orderInterests).where(and(eq(orderInterests.surveyId, surveyId), eq(orderInterests.participantId, participantId)));
  await db.delete(participants).where(eq(participants.id, participantId));

  // Clean up audio files
  for (const file of audioFiles) {
    const filePath = path.join(uploadsDir, file);
    try { fs.unlinkSync(filePath); } catch { /* file may not exist */ }
  }

  return NextResponse.json({ ok: true });
}
