"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewProjectPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });

      if (res.status === 409) {
        const data = await res.json();
        setError(data.error);
        return;
      }

      if (res.ok) {
        const project = await res.json();
        router.push(`/admin/projects/${project.id}`);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
  const labelClass = "block text-sm font-medium text-zinc-700 mb-1.5";

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-12">
        <Link
          href="/admin/projects"
          className="text-sm text-zinc-500 hover:text-zinc-700"
        >
          &larr; Back to projects
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">
          Create New Project
        </h1>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="name" className={labelClass}>
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => { setName(e.target.value); setError(null); }}
              placeholder="e.g. Product X Redesign"
              className={inputClass}
            />
            {error && (
              <p className="mt-1.5 text-sm text-red-600">{error}</p>
            )}
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description for your reference"
              rows={3}
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 text-base font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Project"}
          </button>
        </form>
      </div>
    </div>
  );
}
