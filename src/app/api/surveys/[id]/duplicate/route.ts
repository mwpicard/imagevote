import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { surveys, images } from "@/lib/schema";
import { v4 as uuid } from "uuid";
import path from "path";
import fs from "fs";

const uploadsDir = path.join(process.cwd(), "data", "uploads");

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const source = await db.query.surveys.findFirst({
    where: (s, { eq }) => eq(s.id, id),
    with: { images: { orderBy: (img, { asc }) => [asc(img.sortOrder)] } },
  });

  if (!source) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const newId = uuid();
  const newCode = uuid().slice(0, 8);
  const now = new Date().toISOString();

  // Copy intro/outro media files if present
  let introMediaFilename: string | null = null;
  if (source.introMediaFilename) {
    const ext = path.extname(source.introMediaFilename);
    introMediaFilename = `${newId}-intro${ext}`;
    const src = path.join(uploadsDir, source.introMediaFilename);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(uploadsDir, introMediaFilename));
    }
  }

  let outroMediaFilename: string | null = null;
  if (source.outroMediaFilename) {
    const ext = path.extname(source.outroMediaFilename);
    outroMediaFilename = `${newId}-outro${ext}`;
    const src = path.join(uploadsDir, source.outroMediaFilename);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(uploadsDir, outroMediaFilename));
    }
  }

  let introAudioFilename: string | null = null;
  if (source.introAudioFilename) {
    const ext = path.extname(source.introAudioFilename);
    introAudioFilename = `${newId}-intro-audio${ext}`;
    const src = path.join(uploadsDir, source.introAudioFilename);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(uploadsDir, introAudioFilename));
    }
  }

  let outroAudioFilename: string | null = null;
  if (source.outroAudioFilename) {
    const ext = path.extname(source.outroAudioFilename);
    outroAudioFilename = `${newId}-outro-audio${ext}`;
    const src = path.join(uploadsDir, source.outroAudioFilename);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(uploadsDir, outroAudioFilename));
    }
  }

  // Create the new survey
  await db.insert(surveys).values({
    id: newId,
    title: `${source.title} (copy)`,
    description: source.description,
    introHeading: source.introHeading,
    introBody: source.introBody,
    outroHeading: source.outroHeading,
    outroBody: source.outroBody,
    introMediaFilename,
    outroMediaFilename,
    introAudioFilename,
    outroAudioFilename,
    narrationTiming: source.narrationTiming,
    autoTranscribe: source.autoTranscribe,
    votingMode: source.votingMode,
    language: source.language,
    randomizeOrder: source.randomizeOrder,
    autoRecord: source.autoRecord,
    maxComparisons: source.maxComparisons,
    betaPrice: source.betaPrice,
    preorderUrl: source.preorderUrl,
    projectId: source.projectId,
    code: newCode,
    createdAt: now,
  });

  // Copy images
  for (const img of source.images) {
    const newImageId = uuid();
    const imgExt = path.extname(img.filename);
    const newFilename = `${newImageId}${imgExt}`;

    const imgSrc = path.join(uploadsDir, img.filename);
    if (fs.existsSync(imgSrc)) {
      fs.copyFileSync(imgSrc, path.join(uploadsDir, newFilename));
    }

    let newVideoFilename: string | null = null;
    if (img.videoFilename) {
      const vidExt = path.extname(img.videoFilename);
      newVideoFilename = `${newImageId}-video${vidExt}`;
      const vidSrc = path.join(uploadsDir, img.videoFilename);
      if (fs.existsSync(vidSrc)) {
        fs.copyFileSync(vidSrc, path.join(uploadsDir, newVideoFilename));
      }
    }

    let newAudioFilename: string | null = null;
    if (img.audioFilename) {
      const audExt = path.extname(img.audioFilename);
      newAudioFilename = `${newImageId}-audio${audExt}`;
      const audSrc = path.join(uploadsDir, img.audioFilename);
      if (fs.existsSync(audSrc)) {
        fs.copyFileSync(audSrc, path.join(uploadsDir, newAudioFilename));
      }
    }

    await db.insert(images).values({
      id: newImageId,
      surveyId: newId,
      filename: newFilename,
      videoFilename: newVideoFilename,
      audioFilename: newAudioFilename,
      label: img.label,
      caption: img.caption,
      sortOrder: img.sortOrder,
    });
  }

  // Return the new survey
  const newSurvey = await db.query.surveys.findFirst({
    where: (s, { eq }) => eq(s.id, newId),
    with: { images: { orderBy: (img, { asc }) => [asc(img.sortOrder)] } },
  });

  return NextResponse.json(newSurvey, { status: 201 });
}
