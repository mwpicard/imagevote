"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAudioRecorder } from "@/components/useAudioRecorder";
import { t, type Locale } from "@/lib/i18n";

interface ImageItem {
  id: string;
  filename: string;
  label: string | null;
  sortOrder: number;
}

interface Session {
  id: string;
  title: string;
  votingMode: string;
  language: string;
  code: string;
  images: ImageItem[];
}

interface Pair {
  imageA: ImageItem;
  imageB: ImageItem;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function generatePairs(images: ImageItem[]): Pair[] {
  const pairs: Pair[] = [];
  for (let i = 0; i < images.length; i++) {
    for (let j = i + 1; j < images.length; j++) {
      // Randomize left/right per pair
      if (Math.random() < 0.5) {
        pairs.push({ imageA: images[i], imageB: images[j] });
      } else {
        pairs.push({ imageA: images[j], imageB: images[i] });
      }
    }
  }
  return shuffleArray(pairs);
}

export default function ComparePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();

  const [session, setSession] = useState<Session | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedWinner, setSelectedWinner] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        const data: Session = await res.json();
        setSession(data);
        setPairs(generatePairs(data.images));
      } catch {
        setError("load_error");
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, [params.code]);

  const currentPair = pairs[currentIndex] ?? null;
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

  const handleNext = useCallback(async () => {
    if (!session || !currentPair || !selectedWinner) return;

    setSubmitting(true);

    let finalAudio = audioBlob;
    if (isRecording) {
      finalAudio = await stopRecording();
    }

    try {
      const formData = new FormData();
      formData.append("participantId", participantId);
      formData.append("imageAId", currentPair.imageA.id);
      formData.append("imageBId", currentPair.imageB.id);
      formData.append("winnerId", selectedWinner);

      if (finalAudio && finalAudio.size > 0) {
        const ext = finalAudio.type.includes("mp4") ? ".mp4" : ".webm";
        formData.append("audio", finalAudio, `recording${ext}`);
      }

      const res = await fetch(
        `/api/sessions/${session.id}/pairwise-responses`,
        { method: "POST", body: formData }
      );

      if (!res.ok) {
        throw new Error("Failed to submit response");
      }

      if (currentIndex + 1 >= pairs.length) {
        router.push(`/s/${params.code}/done`);
      } else {
        setCurrentIndex((prev) => prev + 1);
        setSelectedWinner(null);
      }
    } catch {
      setError("submit_error");
    } finally {
      setSubmitting(false);
    }
  }, [
    session,
    currentPair,
    selectedWinner,
    audioBlob,
    isRecording,
    stopRecording,
    participantId,
    currentIndex,
    pairs.length,
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

  if (error || !session || !currentPair) {
    const errorMsg = error === "not_found"
      ? t(lang, "intro.sessionNotFound")
      : error === "load_error"
        ? t(lang, "intro.loadError")
        : error === "submit_error"
          ? t(lang, "eval.submitError")
          : t(lang, "compare.noPairs");
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

  return (
    <div className="flex min-h-dvh flex-col bg-white dark:bg-zinc-950">
      {/* Phase label + Progress */}
      <div className="flex flex-col items-center px-4 pt-4 pb-2">
        <span className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
          {t(lang, "compare.phaseLabel")}
        </span>
        <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
          {t(lang, "compare.pairNofM", { n: currentIndex + 1, total: pairs.length })}
        </span>
      </div>

      {/* Progress track */}
      <div className="mx-4 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className="h-full rounded-full bg-blue-500 transition-all duration-300"
          style={{
            width: `${((currentIndex + 1) / pairs.length) * 100}%`,
          }}
        />
      </div>

      {/* Side-by-side images */}
      <div className="flex flex-1 items-center justify-center gap-3 px-3 pt-4 pb-2">
        {/* Image A */}
        <button
          onClick={() => setSelectedWinner(currentPair.imageA.id)}
          className={`relative flex-1 overflow-hidden rounded-xl border-3 transition-all ${
            selectedWinner === currentPair.imageA.id
              ? "border-blue-500 shadow-lg shadow-blue-500/20"
              : "border-transparent"
          }`}
        >
          <img
            src={`/api/uploads?file=${encodeURIComponent(currentPair.imageA.filename)}`}
            alt={currentPair.imageA.label || "Image A"}
            className="max-h-[40dvh] sm:max-h-[50dvh] w-full object-contain"
          />
          {selectedWinner === currentPair.imageA.id && (
            <div className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          {currentPair.imageA.label && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6">
              <span className="text-sm font-medium text-white">{currentPair.imageA.label}</span>
            </div>
          )}
        </button>

        {/* Divider */}
        <div className="flex flex-col items-center gap-1 text-zinc-300 dark:text-zinc-600">
          <span className="text-xs font-bold">{t(lang, "compare.vs")}</span>
        </div>

        {/* Image B */}
        <button
          onClick={() => setSelectedWinner(currentPair.imageB.id)}
          className={`relative flex-1 overflow-hidden rounded-xl border-3 transition-all ${
            selectedWinner === currentPair.imageB.id
              ? "border-blue-500 shadow-lg shadow-blue-500/20"
              : "border-transparent"
          }`}
        >
          <img
            src={`/api/uploads?file=${encodeURIComponent(currentPair.imageB.filename)}`}
            alt={currentPair.imageB.label || "Image B"}
            className="max-h-[40dvh] sm:max-h-[50dvh] w-full object-contain"
          />
          {selectedWinner === currentPair.imageB.id && (
            <div className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 text-white">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
              </svg>
            </div>
          )}
          {currentPair.imageB.label && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6">
              <span className="text-sm font-medium text-white">{currentPair.imageB.label}</span>
            </div>
          )}
        </button>
      </div>

      {/* Tap instruction */}
      <p className="text-center text-sm text-zinc-400 dark:text-zinc-500">
        {t(lang, "compare.tapInstruction")}
      </p>

      {/* Controls */}
      <div className="flex flex-col items-center gap-5 px-6 pb-8 pt-4">
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
              {t(lang, "eval.recording")}
            </span>
          )}
          {!isRecording && audioBlob && audioBlob.size > 0 && (
            <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
              {t(lang, "eval.audioRecorded")}
            </span>
          )}
        </div>

        {/* Progress bar above button */}
        <div className="w-full max-w-xs">
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-400 dark:text-zinc-500">
            <span>{currentIndex + 1} of {pairs.length}</span>
            <span>{Math.round(((currentIndex + 1) / pairs.length) * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{
                width: `${((currentIndex + 1) / pairs.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Next button */}
        <button
          onClick={handleNext}
          disabled={!selectedWinner || submitting}
          className="h-14 w-full max-w-xs rounded-2xl bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
        >
          {submitting
            ? t(lang, "eval.submitting")
            : currentIndex + 1 >= pairs.length
              ? t(lang, "eval.finish")
              : t(lang, "eval.next")}
        </button>
      </div>
    </div>
  );
}
