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

  let introAudioFilenameEs: string | null = null;
  if (source.introAudioFilenameEs) {
    const ext = path.extname(source.introAudioFilenameEs);
    introAudioFilenameEs = `${newId}-intro-audio-es${ext}`;
    const src = path.join(uploadsDir, source.introAudioFilenameEs);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(uploadsDir, introAudioFilenameEs));
    }
  }

  let introAudioFilenameCa: string | null = null;
  if (source.introAudioFilenameCa) {
    const ext = path.extname(source.introAudioFilenameCa);
    introAudioFilenameCa = `${newId}-intro-audio-ca${ext}`;
    const src = path.join(uploadsDir, source.introAudioFilenameCa);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(uploadsDir, introAudioFilenameCa));
    }
  }

  let outroAudioFilenameEs: string | null = null;
  if (source.outroAudioFilenameEs) {
    const ext = path.extname(source.outroAudioFilenameEs);
    outroAudioFilenameEs = `${newId}-outro-audio-es${ext}`;
    const src = path.join(uploadsDir, source.outroAudioFilenameEs);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(uploadsDir, outroAudioFilenameEs));
    }
  }

  let outroAudioFilenameCa: string | null = null;
  if (source.outroAudioFilenameCa) {
    const ext = path.extname(source.outroAudioFilenameCa);
    outroAudioFilenameCa = `${newId}-outro-audio-ca${ext}`;
    const src = path.join(uploadsDir, source.outroAudioFilenameCa);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(uploadsDir, outroAudioFilenameCa));
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
    introAudioFilenameEs,
    introAudioFilenameCa,
    outroAudioFilename,
    outroAudioFilenameEs,
    outroAudioFilenameCa,
    narrationTiming: source.narrationTiming,
    autoTranscribe: source.autoTranscribe,
    votingMode: source.votingMode,
    language: source.language,
    randomizeOrder: source.randomizeOrder,
    autoRecord: source.autoRecord,
    maxComparisons: source.maxComparisons,
    betaPrice: source.betaPrice,
    preorderUrl: source.preorderUrl,
    introHeadingEs: source.introHeadingEs,
    introHeadingCa: source.introHeadingCa,
    introBodyEs: source.introBodyEs,
    introBodyCa: source.introBodyCa,
    outroHeadingEs: source.outroHeadingEs,
    outroHeadingCa: source.outroHeadingCa,
    outroBodyEs: source.outroBodyEs,
    outroBodyCa: source.outroBodyCa,
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

    let newAudioFilenameEs: string | null = null;
    if (img.audioFilenameEs) {
      const ext = path.extname(img.audioFilenameEs);
      newAudioFilenameEs = `${newImageId}-audio-es${ext}`;
      const src = path.join(uploadsDir, img.audioFilenameEs);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(uploadsDir, newAudioFilenameEs));
      }
    }

    let newAudioFilenameCa: string | null = null;
    if (img.audioFilenameCa) {
      const ext = path.extname(img.audioFilenameCa);
      newAudioFilenameCa = `${newImageId}-audio-ca${ext}`;
      const src = path.join(uploadsDir, img.audioFilenameCa);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(uploadsDir, newAudioFilenameCa));
      }
    }

    await db.insert(images).values({
      id: newImageId,
      surveyId: newId,
      filename: newFilename,
      videoFilename: newVideoFilename,
      audioFilename: newAudioFilename,
      audioFilenameEs: newAudioFilenameEs,
      audioFilenameCa: newAudioFilenameCa,
      label: img.label,
      caption: img.caption,
      captionEs: img.captionEs,
      captionCa: img.captionCa,
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
