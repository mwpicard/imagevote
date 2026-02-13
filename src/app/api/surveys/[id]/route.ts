import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { surveys, images as imagesTable } from "@/lib/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const survey = await db.query.surveys.findFirst({
    where: (s, { eq }) => eq(s.id, id),
    with: { images: { orderBy: (img, { asc }) => [asc(img.sortOrder)] } },
  });

  if (!survey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(survey);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = {
    title: body.title,
    description: body.description,
    introHeading: body.introHeading,
    introBody: body.introBody,
    outroHeading: body.outroHeading,
    outroBody: body.outroBody,
    votingMode: body.votingMode,
    language: body.language,
    randomizeOrder: body.randomizeOrder,
    autoRecord: body.autoRecord,
    narrationTiming: body.narrationTiming,
    betaPrice: body.betaPrice ?? null,
  };
  if ("projectId" in body) {
    updates.projectId = body.projectId;
  }

  await db
    .update(surveys)
    .set(updates)
    .where(eq(surveys.id, id));

  const survey = await db.query.surveys.findFirst({
    where: (s, { eq }) => eq(s.id, id),
    with: { images: { orderBy: (img, { asc }) => [asc(img.sortOrder)] } },
  });

  return NextResponse.json(survey);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Delete intro/outro audio files
  const surveyData = await db.query.surveys.findFirst({
    where: (s, { eq }) => eq(s.id, id),
  });
  const uploadsDir = path.join(process.cwd(), "data", "uploads");
  if (surveyData) {
    for (const fname of [surveyData.introMediaFilename, surveyData.outroMediaFilename, surveyData.introAudioFilename, surveyData.outroAudioFilename]) {
      if (fname) {
        const p = path.join(uploadsDir, fname);
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    }
  }

  // Delete associated files
  const surveyImages = await db.query.images.findMany({
    where: (img, { eq }) => eq(img.surveyId, id),
  });

  for (const img of surveyImages) {
    const imgPath = path.join(uploadsDir, img.filename);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    if (img.videoFilename) {
      const vidPath = path.join(uploadsDir, img.videoFilename);
      if (fs.existsSync(vidPath)) fs.unlinkSync(vidPath);
    }
    if (img.audioFilename) {
      const audPath = path.join(uploadsDir, img.audioFilename);
      if (fs.existsSync(audPath)) fs.unlinkSync(audPath);
    }
  }

  await db.delete(surveys).where(eq(surveys.id, id));
  return NextResponse.json({ success: true });
}
