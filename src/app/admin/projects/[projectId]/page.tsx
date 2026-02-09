"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface ImageItem {
  id: string;
  filename: string;
}

interface SurveyItem {
  id: string;
  title: string;
  code: string;
  createdAt: string;
  votingMode: string;
  images: ImageItem[];
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  surveys: SurveyItem[];
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchProject = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data: Project = await res.json();
        setProject(data);
        setName(data.name);
        setDescription(data.description || "");
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setProject((prev) => (prev ? { ...prev, name: data.name, description: data.description } : prev));
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this project? Surveys will be kept but unassigned.")) return;
    const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/projects");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <p className="text-zinc-500">Project not found.</p>
          <Link
            href="/admin/projects"
            className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-12">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/admin/projects"
              className="text-sm text-zinc-500 hover:text-zinc-700"
            >
              &larr; Back to projects
            </Link>
            {editing ? (
              <div className="mt-2 space-y-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  className={inputClass}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving || !name.trim()}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setName(project.name);
                      setDescription(project.description || "");
                      setEditing(false);
                    }}
                    className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="mt-1 text-2xl font-bold text-zinc-900">
                  {project.name}
                </h1>
                {project.description && (
                  <p className="mt-1 text-sm text-zinc-500">{project.description}</p>
                )}
              </>
            )}
          </div>
          {!editing && (
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(true)}
                className="flex h-10 items-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="flex h-10 items-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-red-600 transition-colors hover:border-red-200 hover:bg-red-50"
              >
                Delete
              </button>
            </div>
          )}
        </div>

        {/* Sessions */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">
            Surveys ({project.surveys.length})
          </h2>
          <Link
            href={`/admin/projects/${projectId}/surveys/new`}
            className="flex h-10 items-center rounded-lg bg-blue-600 px-5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            New Survey
          </Link>
        </div>

        {project.surveys.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white py-12 text-center">
            <p className="text-zinc-400">No surveys yet</p>
            <Link
              href={`/admin/projects/${projectId}/surveys/new`}
              className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Create the first survey
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {project.surveys.map((survey) => (
              <Link
                key={survey.id}
                href={`/admin/surveys/${survey.id}`}
                className="block rounded-xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-zinc-900">
                      {survey.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-zinc-400">
                      {survey.images.length} image{survey.images.length !== 1 ? "s" : ""} &middot;{" "}
                      Code: {survey.code} &middot;{" "}
                      {survey.votingMode === "guided_tour" ? "Guided Tour" : survey.votingMode}
                    </p>
                  </div>
                  <span className="ml-4 text-xs text-zinc-400">
                    {new Date(survey.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
