import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, sessions } from "@/lib/schema";
import { v4 as uuid } from "uuid";
import { desc, eq, isNull, sql } from "drizzle-orm";

export async function GET() {
  // Get all projects with session counts
  const allProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      createdAt: projects.createdAt,
      sessionCount: sql<number>`count(${sessions.id})`.as("session_count"),
    })
    .from(projects)
    .leftJoin(sessions, eq(sessions.projectId, projects.id))
    .groupBy(projects.id)
    .orderBy(desc(projects.createdAt));

  // Count unassigned sessions
  const [unassigned] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessions)
    .where(isNull(sessions.projectId));

  return NextResponse.json({
    projects: allProjects,
    unassignedCount: unassigned.count,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const id = uuid();

  await db.insert(projects).values({
    id,
    name: body.name || "Untitled Project",
    description: body.description || null,
    createdAt: new Date().toISOString(),
  });

  const project = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });

  return NextResponse.json(project, { status: 201 });
}
