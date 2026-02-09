import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { projects, surveys } from "@/lib/schema";
import { v4 as uuid } from "uuid";
import { desc, eq, isNull, sql } from "drizzle-orm";

export async function GET() {
  // Get all projects with survey counts
  const allProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      createdAt: projects.createdAt,
      surveyCount: sql<number>`count(${surveys.id})`.as("survey_count"),
    })
    .from(projects)
    .leftJoin(surveys, eq(surveys.projectId, projects.id))
    .groupBy(projects.id)
    .orderBy(desc(projects.createdAt));

  // Count unassigned surveys
  const [unassigned] = await db
    .select({ count: sql<number>`count(*)` })
    .from(surveys)
    .where(isNull(surveys.projectId));

  return NextResponse.json({
    projects: allProjects,
    unassignedCount: unassigned.count,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = body.name?.trim() || "Untitled Project";

  // Check for duplicate project name
  const existing = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.name, name),
  });
  if (existing) {
    return NextResponse.json(
      { error: `A project named "${name}" already exists.` },
      { status: 409 }
    );
  }

  const id = uuid();

  await db.insert(projects).values({
    id,
    name,
    description: body.description || null,
    createdAt: new Date().toISOString(),
  });

  const project = await db.query.projects.findFirst({
    where: (p, { eq }) => eq(p.id, id),
  });

  return NextResponse.json(project, { status: 201 });
}
