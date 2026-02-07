import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
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
  const { id: sessionId } = await params;
  ensureUploadsDir();

  const formData = await req.formData();
  const target = formData.get("target") as string; // "intro" or "outro"
  const file = formData.get("file") as File | null;

  if (!target || !file || (target !== "intro" && target !== "outro")) {
    return NextResponse.json(
      { error: "target (intro|outro) and file are required" },
      { status: 400 }
    );
  }

  // Delete old file if exists
  const session = await db.query.sessions.findFirst({
    where: (s, { eq }) => eq(s.id, sessionId),
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const oldFilename = target === "intro" ? session.introMediaFilename : session.outroMediaFilename;
  if (oldFilename) {
    const oldPath = path.join(uploadsDir, oldFilename);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  // Save new file
  const ext = path.extname(file.name) || ".jpg";
  const filename = `${target}-media-${uuid()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);

  // Update session
  const updateData = target === "intro"
    ? { introMediaFilename: filename }
    : { outroMediaFilename: filename };
  await db.update(sessions).set(updateData).where(eq(sessions.id, sessionId));

  return NextResponse.json({ filename }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const { target } = await req.json();

  if (target !== "intro" && target !== "outro") {
    return NextResponse.json({ error: "target must be intro or outro" }, { status: 400 });
  }

  const session = await db.query.sessions.findFirst({
    where: (s, { eq }) => eq(s.id, sessionId),
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const filename = target === "intro" ? session.introMediaFilename : session.outroMediaFilename;
  if (filename) {
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  const updateData = target === "intro"
    ? { introMediaFilename: null }
    : { outroMediaFilename: null };
  await db.update(sessions).set(updateData).where(eq(sessions.id, sessionId));

  return NextResponse.json({ success: true });
}
