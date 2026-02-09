import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { surveys } from "@/lib/schema";
import { v4 as uuid } from "uuid";
import { desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");

  const allSurveys = await db.query.surveys.findMany({
    where: projectId === "none"
      ? (s, { isNull }) => isNull(s.projectId)
      : projectId
        ? (s, { eq }) => eq(s.projectId, projectId)
        : undefined,
    orderBy: [desc(surveys.createdAt)],
    with: { images: true },
  });
  return NextResponse.json(allSurveys);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const id = uuid();
  const code = uuid().slice(0, 8);

  await db.insert(surveys).values({
    id,
    title: body.title || "Untitled Survey",
    description: body.description || null,
    introHeading: body.introHeading || "Welcome",
    introBody: body.introBody || "You will be shown a series of images. For each one, share your impressions and vote.",
    outroHeading: body.outroHeading || "Thank you!",
    outroBody: body.outroBody || "Your feedback has been recorded.",
    votingMode: body.votingMode || "binary",
    language: body.language || "en",
    randomizeOrder: body.randomizeOrder || false,
    autoRecord: body.autoRecord || false,
    projectId: body.projectId || null,
    code,
    createdAt: new Date().toISOString(),
  });

  const survey = await db.query.surveys.findFirst({
    where: (s, { eq }) => eq(s.id, id),
  });

  return NextResponse.json(survey, { status: 201 });
}
