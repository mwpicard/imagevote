import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, sessions } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const project = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, id),
    with: {
      sessions: {
        with: { images: true },
        orderBy: (s, { desc }) => [desc(s.createdAt)],
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  await db
    .update(projects)
    .set({
      name: body.name,
      description: body.description,
    })
    .where(eq(projects.id, id));

  const project = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });

  return NextResponse.json(project);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Orphan sessions (SET NULL via FK) then delete project
  await db
    .update(sessions)
    .set({ projectId: null })
    .where(eq(sessions.projectId, id));

  await db.delete(projects).where(eq(projects.id, id));

  return NextResponse.json({ success: true });
}
