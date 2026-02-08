"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAudioRecorder } from "@/components/useAudioRecorder";
import { t, type Locale } from "@/lib/i18n";

interface Session {
  id: string;
  outroHeading: string;
  outroBody: string;
  outroMediaFilename: string | null;
  language: string;
  code: string;
  images: { id: string }[];
}

export default function DonePage() {
  const params = useParams<{ code: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { isRecording, audioBlob, startRecording, stopRecording } =
    useAudioRecorder();

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/sessions/by-code/${params.code}`);
        if (!res.ok) {
          setError("not_found");
          return;
        }
        const data = await res.json();
        setSession(data);
      } catch {
        setError("load_error");
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, [params.code]);

  const participantId =
    typeof window !== "undefined"
      ? localStorage.getItem(`imagevote-participant-${params.code}`) ?? ""
      : "";

  const lang = (
    (typeof window !== "undefined"
      ? localStorage.getItem(`imagevote-lang-${params.code}`)
      : null) || session?.language || "en"
  ) as Locale;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  async function handleMicToggle() {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }

  async function handleSubmitRecording() {
    if (!session || !audioBlob || audioBlob.size === 0) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("participantId", participantId);
      const ext = audioBlob.type.includes("mp4") ? ".mp4" : ".webm";
      formData.append("audio", audioBlob, `outro-recording${ext}`);

      const res = await fetch(
        `/api/sessions/${session.id}/outro-recording`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) {
        throw new Error("Failed to submit recording");
      }

      setSubmitted(true);
    } catch {
      setError("submit_error");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-600" />
      </div>
    );
  }

  if (error || !session) {
    const errorMsg = error === "not_found"
      ? t(lang, "intro.sessionNotFound")
      : error === "load_error"
        ? t(lang, "intro.loadError")
        : error === "submit_error"
          ? t(lang, "done.submitError")
          : t(lang, "intro.sessionNotFound");
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white px-6 dark:bg-zinc-950">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100">
            {t(lang, "eval.oops")}
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            {errorMsg}
          </p>
        </div>
      </div>
    );
  }

  const hasMedia = !!session.outroMediaFilename;
  const isOutroVideo = hasMedia && /\.(mp4|webm|mov)$/i.test(session.outroMediaFilename!);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-white px-6 dark:bg-zinc-950">
      {/* Background media */}
      {hasMedia && (
        isOutroVideo ? (
          <video
            src={`/api/uploads?file=${encodeURIComponent(session.outroMediaFilename!)}`}
            autoPlay
            loop
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <img
            src={`/api/uploads?file=${encodeURIComponent(session.outroMediaFilename!)}`}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )
      )}
      {hasMedia && <div className="absolute inset-0 bg-black/50" />}

      <div className={`relative z-10 flex w-full max-w-lg flex-col items-center text-center ${hasMedia ? "text-white" : ""}`}>
        <div className={`flex h-16 w-16 items-center justify-center rounded-full ${hasMedia ? "bg-white/20" : "bg-green-50 dark:bg-green-950"}`}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-8 w-8 ${hasMedia ? "text-white" : "text-green-500"}`}
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 className={`mt-6 text-4xl font-bold leading-tight tracking-tight sm:text-5xl ${hasMedia ? "text-white" : "text-zinc-900 dark:text-zinc-50"}`}>
          {session.outroHeading}
        </h1>

        <p className={`mt-6 text-lg leading-relaxed ${hasMedia ? "text-white/80" : "text-zinc-600 dark:text-zinc-400"}`}>
          {session.outroBody}
        </p>

        {/* Record final thoughts */}
        {!submitted && (
          <div className="mt-10 flex flex-col items-center gap-4">
            <p className={`text-sm font-medium ${hasMedia ? "text-white/60" : "text-zinc-400 dark:text-zinc-500"}`}>
              {t(lang, "done.finalThoughts")}
            </p>

            <button
              onClick={handleMicToggle}
              className={`flex h-14 w-14 items-center justify-center rounded-full transition-all ${
                isRecording
                  ? "animate-pulse bg-red-500 text-white"
                  : hasMedia
                    ? "bg-white/20 text-white hover:bg-white/30"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
              aria-label={
                isRecording ? "Stop recording" : "Record final thoughts"
              }
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-6 w-6"
              >
                <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Z" />
                <path d="M6 11a1 1 0 1 0-2 0 8 8 0 0 0 7 7.93V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-2.07A8 8 0 0 0 20 11a1 1 0 1 0-2 0 6 6 0 0 1-12 0Z" />
              </svg>
            </button>

            {isRecording && (
              <span className="text-sm font-medium text-red-500">
                {t(lang, "eval.recording")}
              </span>
            )}

            {!isRecording && audioBlob && audioBlob.size > 0 && (
              <div className="flex flex-col items-center gap-3">
                <span className={`text-sm font-medium ${hasMedia ? "text-white/60" : "text-zinc-400 dark:text-zinc-500"}`}>
                  {t(lang, "eval.audioRecorded")}
                </span>
                <button
                  onClick={handleSubmitRecording}
                  disabled={submitting}
                  className={`h-12 rounded-2xl px-8 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    hasMedia
                      ? "bg-white text-zinc-900 hover:bg-white/90 active:bg-white/80"
                      : "bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
                  }`}
                >
                  {submitting ? t(lang, "done.submitting") : t(lang, "done.submitRecording")}
                </button>
              </div>
            )}
          </div>
        )}

        {submitted && (
          <p className={`mt-8 text-sm font-medium ${hasMedia ? "text-green-300" : "text-green-600 dark:text-green-400"}`}>
            {t(lang, "done.confirmation")}
          </p>
        )}

        <p className={`mt-12 text-sm ${hasMedia ? "text-white/40" : "text-zinc-300 dark:text-zinc-700"}`}>
          {t(lang, "done.closeTab")}
        </p>
      </div>
    </div>
  );
}
