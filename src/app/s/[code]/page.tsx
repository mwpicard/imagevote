"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Session {
  id: string;
  title: string;
  introHeading: string;
  introBody: string;
  introMediaFilename: string | null;
  outroHeading: string;
  outroBody: string;
  outroMediaFilename: string | null;
  votingMode: "binary" | "scale" | "pairwise" | "guided_tour";
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
      const id = typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(storageKey, id);
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

  const hasMedia = !!session.introMediaFilename;
  const isVideo = hasMedia && /\.(mp4|webm|mov)$/i.test(session.introMediaFilename!);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-white px-6 dark:bg-zinc-950">
      {/* Background media */}
      {hasMedia && (
        isVideo ? (
          <video
            src={`/api/uploads?file=${encodeURIComponent(session.introMediaFilename!)}`}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <img
            src={`/api/uploads?file=${encodeURIComponent(session.introMediaFilename!)}`}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )
      )}
      {hasMedia && <div className="absolute inset-0 bg-black/50" />}

      <div className={`relative z-10 flex w-full max-w-lg flex-col items-center text-center ${hasMedia ? "text-white" : ""}`}>
        <h1 className={`text-4xl font-bold leading-tight tracking-tight sm:text-5xl ${hasMedia ? "text-white" : "text-zinc-900 dark:text-zinc-50"}`}>
          {session.introHeading}
        </h1>

        <p className={`mt-6 text-lg leading-relaxed ${hasMedia ? "text-white/80" : "text-zinc-600 dark:text-zinc-400"}`}>
          {session.introBody}
        </p>

        <p className={`mt-8 text-sm font-medium ${hasMedia ? "text-white/60" : "text-zinc-400 dark:text-zinc-500"}`}>
          {session.votingMode === "guided_tour" ? (
            <>
              You&apos;ll evaluate {session.images.length} image
              {session.images.length !== 1 ? "s" : ""}, then compare{" "}
              {(session.images.length * (session.images.length - 1)) / 2} pairs
            </>
          ) : (
            <>
              You&apos;ll see {session.images.length} image
              {session.images.length !== 1 ? "s" : ""}
            </>
          )}
        </p>

        <button
          onClick={handleStart}
          className={`mt-10 h-14 w-full max-w-xs rounded-2xl text-lg font-semibold transition-colors ${
            hasMedia
              ? "bg-white text-zinc-900 hover:bg-white/90 active:bg-white/80"
              : "bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
          }`}
        >
          Start
        </button>
      </div>
    </div>
  );
}
