"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAudioRecorder } from "@/components/useAudioRecorder";

interface ImageItem {
  id: string;
  filename: string;
  videoFilename: string | null;
  label: string | null;
  sortOrder: number;
}

interface Session {
  id: string;
  title: string;
  introHeading: string;
  introBody: string;
  outroHeading: string;
  outroBody: string;
  votingMode: "binary" | "scale" | "pairwise" | "guided_tour";
  randomizeOrder: boolean;
  code: string;
  images: ImageItem[];
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function EvaluatePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [orderedImages, setOrderedImages] = useState<ImageItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [vote, setVote] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);

  const { isRecording, audioBlob, startRecording, stopRecording } =
    useAudioRecorder();

  // Fetch session
  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/sessions/by-code/${params.code}`);
        if (!res.ok) {
          setError("Session not found.");
          return;
        }
        const data: Session = await res.json();
        setSession(data);

        const imgs = data.randomizeOrder
          ? shuffleArray(data.images)
          : data.images;
        setOrderedImages(imgs);
      } catch {
        setError("Failed to load session.");
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, [params.code]);

  const currentImage = orderedImages[currentIndex] ?? null;
  const participantId =
    typeof window !== "undefined"
      ? localStorage.getItem(`imagevote-participant-${params.code}`) ?? ""
      : "";

  const handleNext = useCallback(async () => {
    if (!session || !currentImage || vote === null) return;

    setSubmitting(true);

    // If still recording, stop first
    let finalAudio = audioBlob;
    if (isRecording) {
      finalAudio = await stopRecording();
    }

    try {
      const formData = new FormData();
      formData.append("imageId", currentImage.id);
      formData.append("participantId", participantId);
      formData.append("vote", String(vote));

      if (finalAudio && finalAudio.size > 0) {
        const ext = finalAudio.type.includes("mp4") ? ".mp4" : ".webm";
        formData.append("audio", finalAudio, `recording${ext}`);
      }

      const res = await fetch(`/api/sessions/${session.id}/responses`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to submit response");
      }

      // Move to next image or done
      if (currentIndex + 1 >= orderedImages.length) {
        if (session.votingMode === "guided_tour") {
          router.push(`/s/${params.code}/compare`);
        } else {
          router.push(`/s/${params.code}/done`);
        }
      } else {
        setCurrentIndex((prev) => prev + 1);
        setVote(null);
      }
    } catch {
      setError("Failed to submit your response. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    session,
    currentImage,
    vote,
    audioBlob,
    isRecording,
    stopRecording,
    participantId,
    currentIndex,
    orderedImages.length,
    router,
    params.code,
  ]);

  async function handleMicToggle() {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-600" />
      </div>
    );
  }

  if (error || !session || !currentImage) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white px-6 dark:bg-zinc-950">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100">
            Oops
          </h1>
          <p className="mt-2 text-zinc-500 dark:text-zinc-400">
            {error || "No images to evaluate."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white dark:bg-zinc-950">
      {/* Progress bar */}
      <div className="flex flex-col items-center px-4 pt-4 pb-2">
        {session.votingMode === "guided_tour" && (
          <span className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            Phase 1 of 2 — Rate
          </span>
        )}
        <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
          {currentIndex + 1} of {orderedImages.length}
        </span>
      </div>

      {/* Progress track */}
      <div className="mx-4 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-zinc-400 transition-all duration-300 dark:bg-zinc-500"
          style={{
            width: `${((currentIndex + 1) / orderedImages.length) * 100}%`,
          }}
        />
      </div>

      {/* Image */}
      <div className="flex flex-1 items-center justify-center px-4 pt-4 pb-2">
        <img
          src={`/api/uploads?file=${encodeURIComponent(currentImage.filename)}`}
          alt={currentImage.label || `Image ${currentIndex + 1}`}
          className="max-h-[55dvh] w-full rounded-xl object-contain"
        />
      </div>

      {/* Controls area */}
      <div className="flex flex-col items-center gap-5 px-6 pb-8 pt-2">
        {/* Video link */}
        {currentImage.videoFilename && (
          <button
            onClick={() => setShowVideo(true)}
            className="text-sm font-medium text-zinc-400 underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:decoration-zinc-600 dark:hover:text-zinc-300"
          >
            See video
          </button>
        )}

        {/* Voting controls */}
        <div className="flex items-center justify-center gap-3">
          {(session.votingMode === "binary" || session.votingMode === "guided_tour") && (
            <>
              <button
                onClick={() => setVote(0)}
                className={`flex h-16 w-16 items-center justify-center rounded-2xl border-2 text-2xl transition-all ${
                  vote === 0
                    ? "border-red-400 bg-red-50 dark:border-red-500 dark:bg-red-950"
                    : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
                }`}
                aria-label="Thumbs down"
              >
                <span role="img" aria-hidden="true">
                  👎
                </span>
              </button>
              <button
                onClick={() => setVote(1)}
                className={`flex h-16 w-16 items-center justify-center rounded-2xl border-2 text-2xl transition-all ${
                  vote === 1
                    ? "border-green-400 bg-green-50 dark:border-green-500 dark:bg-green-950"
                    : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
                }`}
                aria-label="Thumbs up"
              >
                <span role="img" aria-hidden="true">
                  👍
                </span>
              </button>
            </>
          )}

          {session.votingMode === "scale" && (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setVote(n)}
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl border-2 text-lg font-bold transition-all ${
                      vote === n
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                        : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600"
                    }`}
                    aria-label={`Rate ${n}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex w-full justify-between px-1">
                <span className="text-xs text-zinc-400 dark:text-zinc-500">Blah!</span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">Great!</span>
              </div>
            </div>
          )}

          {session.votingMode === "pairwise" && (
            <button
              onClick={() => setVote(1)}
              className={`h-14 rounded-2xl border-2 px-8 text-base font-semibold transition-all ${
                vote === 1
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600"
              }`}
            >
              Prefer This
            </button>
          )}
        </div>

        {/* Audio recording */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleMicToggle}
            className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
              isRecording
                ? "animate-pulse bg-red-500 text-white"
                : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-5 w-5"
            >
              <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Z" />
              <path d="M6 11a1 1 0 1 0-2 0 8 8 0 0 0 7 7.93V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-2.07A8 8 0 0 0 20 11a1 1 0 1 0-2 0 6 6 0 0 1-12 0Z" />
            </svg>
          </button>
          {isRecording && (
            <span className="text-xs font-medium text-red-500">
              Recording...
            </span>
          )}
          {!isRecording && audioBlob && audioBlob.size > 0 && (
            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
              Audio recorded
            </span>
          )}
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          disabled={vote === null || submitting}
          className="h-14 w-full max-w-xs rounded-2xl bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
        >
          {submitting
            ? "Submitting..."
            : currentIndex + 1 >= orderedImages.length
              ? session.votingMode === "guided_tour"
                ? "Next Phase"
                : "Finish"
              : "Next"}
        </button>
      </div>

      {/* Video overlay */}
      {showVideo && currentImage.videoFilename && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowVideo(false)}
        >
          <div
            className="relative w-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowVideo(false)}
              className="absolute -top-12 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
              aria-label="Close video"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <video
              src={`/api/uploads?file=${encodeURIComponent(currentImage.videoFilename)}`}
              controls
              autoPlay
              className="w-full rounded-xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
