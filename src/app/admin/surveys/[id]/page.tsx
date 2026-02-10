"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";

interface ImageItem {
  id: string;
  filename: string;
  videoFilename: string | null;
  label: string | null;
  sortOrder: number;
}

interface Survey {
  id: string;
  title: string;
  description: string | null;
  votingMode: "binary" | "scale" | "pairwise" | "guided_tour";
  language: string;
  projectId: string | null;
  code: string;
  createdAt: string;
  images: ImageItem[];
}

interface Participant {
  id: string;
  firstName: string;
  lastName: string | null;
  age: number | null;
  createdAt: string;
}

interface ResponseData {
  id: string;
  imageId: string;
  participantId: string;
  vote: number | null;
  audioFilename: string | null;
  createdAt: string;
}

interface PairwiseResponseData {
  id: string;
  participantId: string;
  winnerId: string | null;
  createdAt: string;
}

const MODE_LABELS: Record<string, string> = {
  binary: "Binary",
  scale: "Scale (1-5)",
  pairwise: "Pairwise",
  guided_tour: "Guided Tour",
};

export default function SurveyOverviewPage() {
  const { id } = useParams<{ id: string }>();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [responses, setResponses] = useState<ResponseData[]>([]);
  const [pairwiseResponses, setPairwiseResponses] = useState<PairwiseResponseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/surveys/${id}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/surveys/${id}/participants`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/surveys/${id}/responses`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/surveys/${id}/pairwise-responses`).then((r) => (r.ok ? r.json() : [])),
    ]).then(([surveyData, participantsData, responsesData, pairwiseData]) => {
      setSurvey(surveyData);
      setParticipants(Array.isArray(participantsData) ? participantsData : []);
      setResponses(Array.isArray(responsesData) ? responsesData : []);
      setPairwiseResponses(Array.isArray(pairwiseData) ? pairwiseData : []);
      setLoading(false);
    });
  }, [id]);

  async function handleDeleteParticipant(participantId: string, name: string) {
    if (!confirm(`Delete participant "${name}" and all their responses?`)) return;
    setDeleting(participantId);
    try {
      const res = await fetch(`/api/surveys/${id}/participants?participantId=${participantId}`, { method: "DELETE" });
      if (res.ok) {
        setParticipants((prev) => prev.filter((p) => p.id !== participantId));
        setResponses((prev) => prev.filter((r) => r.participantId !== participantId));
        setPairwiseResponses((prev) => prev.filter((r) => r.participantId !== participantId));
      }
    } finally {
      setDeleting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <p className="text-zinc-500">Survey not found.</p>
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

  const sessionUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/s/${survey.code}`;
  const isGuidedTour = survey.votingMode === "guided_tour";

  // Per-participant response counts
  const responsesPerParticipant = new Map<string, number>();
  for (const r of responses) {
    responsesPerParticipant.set(r.participantId, (responsesPerParticipant.get(r.participantId) || 0) + 1);
  }
  const pairwisePerParticipant = new Map<string, number>();
  for (const r of pairwiseResponses) {
    pairwisePerParticipant.set(r.participantId, (pairwisePerParticipant.get(r.participantId) || 0) + 1);
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={survey.projectId ? `/admin/projects/${survey.projectId}` : "/admin/projects"}
            className="text-sm text-zinc-500 hover:text-zinc-700"
          >
            &larr; {survey.projectId ? "Back to project" : "Back to projects"}
          </Link>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">{survey.title}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                  {MODE_LABELS[survey.votingMode] || survey.votingMode}
                </span>
                <span>{survey.language.toUpperCase()}</span>
                <span>&middot;</span>
                <span>{new Date(survey.createdAt).toLocaleDateString()}</span>
                <span>&middot;</span>
                <span>{survey.images.length} image{survey.images.length !== 1 ? "s" : ""}</span>
              </div>
              {survey.description && (
                <p className="mt-2 text-sm text-zinc-500">{survey.description}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Link
                href={`/admin/surveys/${id}/edit`}
                className="flex h-10 items-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
              >
                Edit Survey
              </Link>
              <Link
                href={`/admin/surveys/${id}/results`}
                className="flex h-10 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Survey Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Share Section */}
        <div className="mb-8 rounded-xl border border-zinc-200 bg-white p-6 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <QRCodeSVG value={sessionUrl} size={100} />
          <div className="flex-1 text-center sm:text-left">
            <p className="text-sm font-medium text-zinc-700 mb-1.5">Share this survey</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <input
                readOnly
                value={sessionUrl}
                className="h-10 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-700 focus:outline-none"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(sessionUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="h-10 min-w-[5rem] rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-sm text-zinc-500">
              Code: <span className="font-mono font-bold">{survey.code}</span>
            </p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className={`mb-8 grid gap-4 ${isGuidedTour ? "grid-cols-3" : "grid-cols-2"}`}>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 text-center">
            <p className="text-3xl font-bold text-zinc-900">{participants.length}</p>
            <p className="mt-1 text-sm text-zinc-500">Participant{participants.length !== 1 ? "s" : ""}</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-5 text-center">
            <p className="text-3xl font-bold text-zinc-900">{responses.length}</p>
            <p className="mt-1 text-sm text-zinc-500">Response{responses.length !== 1 ? "s" : ""}</p>
          </div>
          {isGuidedTour && (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 text-center">
              <p className="text-3xl font-bold text-zinc-900">{pairwiseResponses.length}</p>
              <p className="mt-1 text-sm text-zinc-500">Comparison{pairwiseResponses.length !== 1 ? "s" : ""}</p>
            </div>
          )}
        </div>

        {/* Participant Sessions */}
        <div>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900">
            Participants ({participants.length})
          </h2>

          {participants.length === 0 ? (
            <div className="rounded-xl border border-zinc-200 bg-white py-12 text-center">
              <p className="text-zinc-400">No participants yet</p>
              <p className="mt-1 text-sm text-zinc-400">Share the survey link to start collecting responses</p>
            </div>
          ) : (
            <div className="space-y-2">
              {participants.map((p) => {
                const rCount = responsesPerParticipant.get(p.id) || 0;
                const pCount = pairwisePerParticipant.get(p.id) || 0;
                const name = p.lastName ? `${p.firstName} ${p.lastName}` : p.firstName;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white px-5 py-4"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-600">
                      {p.firstName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900">
                        {name}
                        {p.age != null && (
                          <span className="ml-1.5 text-zinc-400">({p.age})</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {new Date(p.createdAt).toLocaleDateString()}{" "}
                        {new Date(p.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3 text-xs text-zinc-500">
                      <span>{rCount} rating{rCount !== 1 ? "s" : ""}</span>
                      {isGuidedTour && (
                        <span>{pCount} comparison{pCount !== 1 ? "s" : ""}</span>
                      )}
                      <button
                        onClick={() => handleDeleteParticipant(p.id, name)}
                        disabled={deleting === p.id}
                        className="ml-1 rounded p-1 text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                        title="Delete participant and all responses"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
