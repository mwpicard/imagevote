import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const session = await db.query.sessions.findFirst({
    where: (s, { eq }) => eq(s.code, code),
    with: { images: { orderBy: (img, { asc }) => [asc(img.sortOrder)] } },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}
