import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sessions } from "@/lib/schema";
import { v4 as uuid } from "uuid";
import { desc } from "drizzle-orm";

export async function GET() {
  const allSessions = await db.query.sessions.findMany({
    orderBy: [desc(sessions.createdAt)],
    with: { images: true },
  });
  return NextResponse.json(allSessions);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const id = uuid();
  const code = uuid().slice(0, 8);

  await db.insert(sessions).values({
    id,
    title: body.title || "Untitled Session",
    description: body.description || null,
    introHeading: body.introHeading || "Welcome",
    introBody: body.introBody || "You will be shown a series of images. For each one, share your impressions and vote.",
    outroHeading: body.outroHeading || "Thank you!",
    outroBody: body.outroBody || "Your feedback has been recorded.",
    votingMode: body.votingMode || "binary",
    randomizeOrder: body.randomizeOrder || false,
    code,
    createdAt: new Date().toISOString(),
  });

  const session = await db.query.sessions.findFirst({
    where: (s, { eq }) => eq(s.id, id),
  });

  return NextResponse.json(session, { status: 201 });
}
