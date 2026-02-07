"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Session {
  id: string;
  title: string;
  introHeading: string;
  introBody: string;
  outroHeading: string;
  outroBody: string;
  votingMode: "binary" | "scale" | "pairwise";
  randomizeOrder: boolean;
  code: string;
  images: { id: string }[];
}

export default function IntroPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/sessions/by-code/${params.code}`);
        if (!res.ok) {
          setError("Session not found.");
          return;
        }
        const data = await res.json();
        setSession(data);
      } catch {
        setError("Failed to load session.");
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, [params.code]);

  // Generate participantId on mount
  useEffect(() => {
    const storageKey = `imagevote-participant-${params.code}`;
    if (!localStorage.getItem(storageKey)) {
      localStorage.setItem(storageKey, crypto.randomUUID());
    }
  }, [params.code]);

  function handleStart() {
    router.push(`/s/${params.code}/evaluate`);
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-600" />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white px-6 dark:bg-zinc-950">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100">
            Oops
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            {error || "Session not found."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-white px-6 dark:bg-zinc-950">
      <div className="flex w-full max-w-lg flex-col items-center text-center">
        <h1 className="text-4xl font-bold leading-tight tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          {session.introHeading}
        </h1>

        <p className="mt-6 text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          {session.introBody}
        </p>

        <p className="mt-8 text-sm font-medium text-zinc-400 dark:text-zinc-500">
          You&apos;ll see {session.images.length} image
          {session.images.length !== 1 ? "s" : ""}
        </p>

        <button
          onClick={handleStart}
          className="mt-10 h-14 w-full max-w-xs rounded-2xl bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
        >
          Start
        </button>
      </div>
    </div>
  );
}
