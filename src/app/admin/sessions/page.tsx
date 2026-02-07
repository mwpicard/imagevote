"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Session {
  id: string;
  title: string;
  description: string | null;
  code: string;
  votingMode: string;
  createdAt: string;
  images: { id: string }[];
}

export default function SessionListPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchSessions() {
    setLoading(true);
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSessions();
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this session? This cannot be undone.")) {
      return;
    }
    const res = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSessions((prev) => prev.filter((s) => s.id !== id));
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="text-sm text-zinc-500 hover:text-zinc-700"
            >
              &larr; Home
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-zinc-900">Sessions</h1>
          </div>
          <Link
            href="/admin/sessions/new"
            className="flex h-11 items-center rounded-lg bg-blue-600 px-5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Create New Session
          </Link>
        </div>

        {loading ? (
          <div className="py-20 text-center text-zinc-400">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 bg-white py-20 text-center">
            <p className="text-zinc-500">No sessions yet.</p>
            <Link
              href="/admin/sessions/new"
              className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Create your first session
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-5 transition-shadow hover:shadow-sm"
              >
                <Link
                  href={`/admin/sessions/${session.id}`}
                  className="flex-1"
                >
                  <h2 className="text-lg font-semibold text-zinc-900">
                    {session.title}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-zinc-500">
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                      {session.code}
                    </span>
                    <span>{session.images.length} image{session.images.length !== 1 ? "s" : ""}</span>
                    <span className="capitalize">{session.votingMode === "guided_tour" ? "Guided Tour" : session.votingMode}</span>
                    <span>
                      {new Date(session.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
                <button
                  onClick={() => handleDelete(session.id)}
                  className="ml-4 flex h-9 items-center rounded-lg border border-zinc-200 px-3 text-sm text-red-600 transition-colors hover:border-red-200 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
