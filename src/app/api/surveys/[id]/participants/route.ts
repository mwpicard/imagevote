import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { participants } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

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

  await db.insert(participants).values({
    id: participantId,
    surveyId: id,
    firstName,
    lastName: body.lastName?.trim() || null,
    age: body.age ? Number(body.age) : null,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json(
    { id: participantId, firstName, lastName: body.lastName?.trim() || null, age: body.age ? Number(body.age) : null },
    { status: 201 }
  );
}
