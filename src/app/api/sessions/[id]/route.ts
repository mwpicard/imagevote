import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions, images as imagesTable } from "@/lib/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await db.query.sessions.findFirst({
    where: (s, { eq }) => eq(s.id, id),
    with: { images: { orderBy: (img, { asc }) => [asc(img.sortOrder)] } },
  });

  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  await db
    .update(sessions)
    .set({
      title: body.title,
      description: body.description,
      introHeading: body.introHeading,
      introBody: body.introBody,
      outroHeading: body.outroHeading,
      outroBody: body.outroBody,
      votingMode: body.votingMode,
      randomizeOrder: body.randomizeOrder,
    })
    .where(eq(sessions.id, id));

  const session = await db.query.sessions.findFirst({
    where: (s, { eq }) => eq(s.id, id),
    with: { images: { orderBy: (img, { asc }) => [asc(img.sortOrder)] } },
  });

  return NextResponse.json(session);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Delete associated files
  const sessionImages = await db.query.images.findMany({
    where: (img, { eq }) => eq(img.sessionId, id),
  });

  const uploadsDir = path.join(process.cwd(), "data", "uploads");
  for (const img of sessionImages) {
    const imgPath = path.join(uploadsDir, img.filename);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    if (img.videoFilename) {
      const vidPath = path.join(uploadsDir, img.videoFilename);
      if (fs.existsSync(vidPath)) fs.unlinkSync(vidPath);
    }
  }

  await db.delete(sessions).where(eq(sessions.id, id));
  return NextResponse.json({ success: true });
}
