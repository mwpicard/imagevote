"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ProjectSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  sessionCount: number;
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => {
        setProjects(data.projects);
        setUnassignedCount(data.unassignedCount);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-12">
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-700">
              &larr; Home
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-zinc-900">Projects</h1>
          </div>
          <Link
            href="/admin/projects/new"
            className="flex h-10 items-center rounded-lg bg-blue-600 px-5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            New Project
          </Link>
        </div>

        {projects.length === 0 && unassignedCount === 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white py-16 text-center">
            <p className="text-zinc-400">No projects yet</p>
            <Link
              href="/admin/projects/new"
              className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Create your first project
            </Link>
          </div>
        )}

        {projects.length > 0 && (
          <div className="space-y-3">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/admin/projects/${project.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-base font-semibold text-zinc-900">
                      {project.name}
                    </h2>
                    {project.description && (
                      <p className="mt-0.5 truncate text-sm text-zinc-500">
                        {project.description}
                      </p>
                    )}
                  </div>
                  <div className="ml-4 flex-shrink-0 text-right">
                    <span className="text-sm font-medium text-zinc-600">
                      {project.sessionCount} session{project.sessionCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {unassignedCount > 0 && (
          <div className="mt-8">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
              Unassigned Sessions
            </h2>
            <UnassignedSessions projects={projects} />
          </div>
        )}
      </div>
    </div>
  );
}

function UnassignedSessions({ projects }: { projects: ProjectSummary[] }) {
  interface SessionSummary {
    id: string;
    title: string;
    code: string;
    createdAt: string;
    images: { id: string }[];
  }

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/sessions?projectId=none")
      .then((r) => r.json())
      .then(setSessions)
      .finally(() => setLoading(false));
  }, []);

  async function assignToProject(sessionId: string, projectId: string) {
    await fetch(`/api/sessions/${sessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    setSessions((prev) => prev.filter((s) => s.id !== sessionId));
  }

  if (loading) return <p className="text-sm text-zinc-400">Loading...</p>;

  return (
    <div className="space-y-3">
      {sessions.map((session) => (
        <div
          key={session.id}
          className="flex items-center gap-4 rounded-xl border border-dashed border-zinc-300 bg-white p-4"
        >
          <div className="min-w-0 flex-1">
            <Link
              href={`/admin/sessions/${session.id}`}
              className="truncate text-sm font-medium text-zinc-900 hover:text-blue-600"
            >
              {session.title}
            </Link>
            <p className="text-xs text-zinc-400">
              {session.images.length} image{session.images.length !== 1 ? "s" : ""} &middot; Code: {session.code}
            </p>
          </div>
          {projects.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) assignToProject(session.id, e.target.value);
              }}
              className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-700 focus:border-blue-500 focus:outline-none"
            >
              <option value="" disabled>
                Assign to...
              </option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}
    </div>
  );
}
