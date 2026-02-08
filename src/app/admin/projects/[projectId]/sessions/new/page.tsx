"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

export default function NewSessionInProjectPage() {
  const router = useRouter();
  const { projectId } = useParams<{ projectId: string }>();
  const [submitting, setSubmitting] = useState(false);
  const [projectName, setProjectName] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [introHeading, setIntroHeading] = useState("Welcome");
  const [introBody, setIntroBody] = useState(
    "You will be shown a series of images. For each one, share your impressions and vote."
  );
  const [outroHeading, setOutroHeading] = useState("Thank you!");
  const [outroBody, setOutroBody] = useState(
    "Your feedback has been recorded."
  );
  const [votingMode, setVotingMode] = useState<"binary" | "scale" | "pairwise" | "guided_tour">("binary");
  const [randomizeOrder, setRandomizeOrder] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((data) => setProjectName(data.name || ""));
  }, [projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          introHeading,
          introBody,
          outroHeading,
          outroBody,
          votingMode,
          randomizeOrder,
          projectId,
        }),
      });

      if (res.ok) {
        const session = await res.json();
        router.push(`/admin/sessions/${session.id}`);
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
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link
          href={`/admin/projects/${projectId}`}
          className="text-sm text-zinc-500 hover:text-zinc-700"
        >
          &larr; Back to {projectName || "project"}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">
          New Session
        </h1>
        {projectName && (
          <p className="mt-1 text-sm text-zinc-500">
            in {projectName}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="title" className={labelClass}>
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Round 1"
              className={inputClass}
            />
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

          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-zinc-900">
              Intro Screen
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="introHeading" className={labelClass}>
                  Heading
                </label>
                <input
                  id="introHeading"
                  type="text"
                  value={introHeading}
                  onChange={(e) => setIntroHeading(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="introBody" className={labelClass}>
                  Body
                </label>
                <textarea
                  id="introBody"
                  value={introBody}
                  onChange={(e) => setIntroBody(e.target.value)}
                  rows={3}
                  className={inputClass}
                />
              </div>
              <p className="text-sm text-zinc-400">
                Background image/video can be added after creating the session.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-zinc-900">
              Outro Screen
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="outroHeading" className={labelClass}>
                  Heading
                </label>
                <input
                  id="outroHeading"
                  type="text"
                  value={outroHeading}
                  onChange={(e) => setOutroHeading(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="outroBody" className={labelClass}>
                  Body
                </label>
                <textarea
                  id="outroBody"
                  value={outroBody}
                  onChange={(e) => setOutroBody(e.target.value)}
                  rows={3}
                  className={inputClass}
                />
              </div>
              <p className="text-sm text-zinc-400">
                Background image/video can be added after creating the session.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-zinc-900">
              Voting Settings
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="votingMode" className={labelClass}>
                  Voting Mode
                </label>
                <select
                  id="votingMode"
                  value={votingMode}
                  onChange={(e) =>
                    setVotingMode(e.target.value as "binary" | "scale" | "pairwise" | "guided_tour")
                  }
                  className={inputClass}
                >
                  <option value="binary">Binary (Yes / No)</option>
                  <option value="scale">Scale (1-5)</option>
                  <option value="pairwise">Pairwise Comparison</option>
                  <option value="guided_tour">Guided Tour (Rate + Compare)</option>
                </select>
                {votingMode === "guided_tour" && (
                  <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                    Phase 1: Participants rate each image (thumbs up/down). Phase 2: They compare every unique pair side by side.
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="randomizeOrder"
                  type="checkbox"
                  checked={randomizeOrder}
                  onChange={(e) => setRandomizeOrder(e.target.checked)}
                  className="h-5 w-5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="randomizeOrder" className="text-sm text-zinc-700">
                  Randomize image order for each participant
                </label>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 text-base font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Session"}
          </button>
        </form>
      </div>
    </div>
  );
}
