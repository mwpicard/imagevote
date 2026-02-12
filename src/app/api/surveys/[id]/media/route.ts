import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { surveys } from "@/lib/schema";
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

const VALID_TARGETS = ["intro", "outro", "intro-audio", "outro-audio"] as const;
type Target = (typeof VALID_TARGETS)[number];

const TARGET_FIELD_MAP: Record<Target, keyof typeof surveys.$inferSelect> = {
  intro: "introMediaFilename",
  outro: "outroMediaFilename",
  "intro-audio": "introAudioFilename",
  "outro-audio": "outroAudioFilename",
};

function isValidTarget(t: string): t is Target {
  return VALID_TARGETS.includes(t as Target);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;
  ensureUploadsDir();

  const formData = await req.formData();
  const target = formData.get("target") as string;
  const file = formData.get("file") as File | null;

  if (!target || !file || !isValidTarget(target)) {
    return NextResponse.json(
      { error: "target (intro|outro|intro-audio|outro-audio) and file are required" },
      { status: 400 }
    );
  }

  const survey = await db.query.surveys.findFirst({
    where: (s, { eq }) => eq(s.id, surveyId),
  });
  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  // Delete old file if exists
  const field = TARGET_FIELD_MAP[target];
  const oldFilename = survey[field] as string | null;
  if (oldFilename) {
    const oldPath = path.join(uploadsDir, oldFilename);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
  }

  // Save new file
  const ext = path.extname(file.name) || (target.includes("audio") ? ".webm" : ".jpg");
  const prefix = target.includes("audio") ? `${target}-` : `${target}-media-`;
  const filename = `${prefix}${uuid()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(uploadsDir, filename), buffer);

  // Update survey
  const updateData = { [field]: filename };
  await db.update(surveys).set(updateData).where(eq(surveys.id, surveyId));

  return NextResponse.json({ filename }, { status: 201 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: surveyId } = await params;
  const { target } = await req.json();

  if (!isValidTarget(target)) {
    return NextResponse.json(
      { error: "target must be intro, outro, intro-audio, or outro-audio" },
      { status: 400 }
    );
  }

  const survey = await db.query.surveys.findFirst({
    where: (s, { eq }) => eq(s.id, surveyId),
  });
  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  const field = TARGET_FIELD_MAP[target];
  const filename = survey[field] as string | null;
  if (filename) {
    const filePath = path.join(uploadsDir, filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  const updateData = { [field]: null };
  await db.update(surveys).set(updateData).where(eq(surveys.id, surveyId));

  return NextResponse.json({ success: true });
}
