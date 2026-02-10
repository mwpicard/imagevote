"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  surveyCount: number;
}

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((data) => setProjects(data.projects ?? []))
      .finally(() => setLoading(false));
  }, []);

  function handleGo() {
    const trimmed = code.trim();
    if (trimmed) {
      router.push(`/s/${trimmed}`);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <main className="mx-auto max-w-2xl px-6 py-16">
        {/* Hero */}
        <div className="text-center">
          <h1 className="text-5xl font-extrabold tracking-tight text-zinc-900">
            ImageVote
          </h1>
          <p className="mt-3 text-xl font-medium text-blue-600">
            Find out what people really want you to build for them!
          </p>
          <p className="mt-1 text-base text-zinc-500">
            Build and Share Interactive Image Surveys
          </p>
        </div>

        {/* Actions */}
        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:gap-3">
          <Link
            href="/admin/projects/new"
            className="flex h-12 flex-1 items-center justify-center rounded-xl bg-blue-600 text-base font-semibold text-white transition-colors hover:bg-blue-700"
          >
            + New Project
          </Link>
          <div className="flex flex-1 gap-2">
            <input
              type="text"
              placeholder="Enter survey code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleGo();
              }}
              className="h-12 flex-1 rounded-xl border border-zinc-300 bg-white px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              onClick={handleGo}
              className="h-12 rounded-xl bg-zinc-800 px-5 text-base font-medium text-white transition-colors hover:bg-zinc-700"
            >
              Go
            </button>
          </div>
        </div>

        {/* Projects List */}
        <div className="mt-12">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            Projects
          </h2>

          {loading ? (
            <div className="rounded-xl border border-zinc-200 bg-white py-12 text-center">
              <p className="text-zinc-400">Loading...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-12 text-center">
              <p className="text-zinc-400">No projects yet</p>
              <p className="mt-1 text-sm text-zinc-400">
                Create your first project to get started
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/admin/projects/${project.id}`}
                  className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white px-5 py-4 transition-colors hover:border-blue-200 hover:bg-blue-50/50"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-100 text-lg font-bold text-blue-600">
                    {project.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-900">
                      {project.name}
                    </p>
                    {project.description && (
                      <p className="mt-0.5 truncate text-xs text-zinc-500">
                        {project.description}
                      </p>
                    )}
                  </div>
                  <span className="flex-shrink-0 text-xs text-zinc-400">
                    {project.surveyCount} survey{project.surveyCount !== 1 ? "s" : ""}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
