import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const survey = await db.query.surveys.findFirst({
    where: (s, { eq }) => eq(s.code, code),
    with: { images: { orderBy: (img, { asc }) => [asc(img.sortOrder)] } },
  });

  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  return NextResponse.json(survey);
}
