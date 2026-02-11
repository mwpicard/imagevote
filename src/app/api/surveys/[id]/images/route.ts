import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { images } from "@/lib/schema";
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;
  ensureUploadsDir();

  const formData = await req.formData();
  const image = formData.get("image") as File | null;
  const video = formData.get("video") as File | null;
  const audio = formData.get("audio") as File | null;
  const label = formData.get("label") as string | null;
  const sortOrder = parseInt(formData.get("sortOrder") as string) || 0;

  if (!image) {
    return NextResponse.json({ error: "Image is required" }, { status: 400 });
  }

  const imageId = uuid();
  const ext = path.extname(image.name) || ".jpg";
  const imageFilename = `${imageId}${ext}`;
  const imageBuffer = Buffer.from(await image.arrayBuffer());
  fs.writeFileSync(path.join(uploadsDir, imageFilename), imageBuffer);

  let videoFilename: string | null = null;
  if (video) {
    const vidExt = path.extname(video.name) || ".mp4";
    videoFilename = `${imageId}-video${vidExt}`;
    const videoBuffer = Buffer.from(await video.arrayBuffer());
    fs.writeFileSync(path.join(uploadsDir, videoFilename), videoBuffer);
  }

  let audioFilename: string | null = null;
  if (audio) {
    const audExt = path.extname(audio.name) || ".mp3";
    audioFilename = `${imageId}-audio${audExt}`;
    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    fs.writeFileSync(path.join(uploadsDir, audioFilename), audioBuffer);
  }

  await db.insert(images).values({
    id: imageId,
    surveyId,
    filename: imageFilename,
    videoFilename,
    audioFilename,
    label,
    sortOrder,
  });

  const newImage = await db.query.images.findFirst({
    where: (img, { eq }) => eq(img.id, imageId),
  });

  return NextResponse.json(newImage, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  const { imageId } = await req.json();

  if (!imageId) {
    return NextResponse.json({ error: "imageId is required" }, { status: 400 });
  }

  const image = await db.query.images.findFirst({
    where: (img, { eq: e }) => e(img.id, imageId),
  });

  if (!image) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  // Delete files from disk
  const imgPath = path.join(uploadsDir, image.filename);
  if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  if (image.videoFilename) {
    const vidPath = path.join(uploadsDir, image.videoFilename);
    if (fs.existsSync(vidPath)) fs.unlinkSync(vidPath);
  }
  if (image.audioFilename) {
    const audPath = path.join(uploadsDir, image.audioFilename);
    if (fs.existsSync(audPath)) fs.unlinkSync(audPath);
  }

  await db.delete(images).where(eq(images.id, imageId));
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  ensureUploadsDir();

  const formData = await req.formData();
  const imageId = formData.get("imageId") as string | null;
  if (!imageId) {
    return NextResponse.json({ error: "imageId is required" }, { status: 400 });
  }

  const existing = await db.query.images.findFirst({
    where: (img, { eq: e }) => e(img.id, imageId),
  });
  if (!existing) {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }

  const updates: Record<string, string | null> = {};

  // Caption (allow setting to empty string to clear)
  if (formData.has("caption")) {
    const caption = formData.get("caption") as string;
    updates.caption = caption || null;
  }

  // Audio file replacement
  const audio = formData.get("audio") as File | null;
  if (audio) {
    // Delete old audio file if present
    if (existing.audioFilename) {
      const oldPath = path.join(uploadsDir, existing.audioFilename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    const audExt = path.extname(audio.name) || ".mp3";
    const audioFilename = `${imageId}-audio${audExt}`;
    const audioBuffer = Buffer.from(await audio.arrayBuffer());
    fs.writeFileSync(path.join(uploadsDir, audioFilename), audioBuffer);
    updates.audioFilename = audioFilename;
  }

  // Remove audio if explicitly requested
  if (formData.get("removeAudio") === "true" && !audio) {
    if (existing.audioFilename) {
      const oldPath = path.join(uploadsDir, existing.audioFilename);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    updates.audioFilename = null;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(images).set(updates).where(eq(images.id, imageId));
  }

  const updated = await db.query.images.findFirst({
    where: (img, { eq: e }) => e(img.id, imageId),
  });

  return NextResponse.json(updated);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;
  const body = await req.json();

  // Reorder images
  if (body.order && Array.isArray(body.order)) {
    for (let i = 0; i < body.order.length; i++) {
      await db
        .update(images)
        .set({ sortOrder: i })
        .where(eq(images.id, body.order[i]));
    }
  }

  const updated = await db.query.images.findMany({
    where: (img, { eq }) => eq(img.surveyId, surveyId),
    orderBy: (img, { asc }) => [asc(img.sortOrder)],
  });

  return NextResponse.json(updated);
}
