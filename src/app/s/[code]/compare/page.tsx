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

interface Survey {
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

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sliderValue, setSliderValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { isRecording, audioBlob, startRecording, stopRecording } =
    useAudioRecorder();

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/surveys/by-code/${params.code}`);
        if (!res.ok) {
          setError("not_found");
          return;
        }
        const data: Survey = await res.json();
        setSurvey(data);
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
      : null) || survey?.language || "en"
  ) as Locale;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Derive winnerId from slider
  const winnerId =
    sliderValue < 0
      ? currentPair?.imageA.id ?? null
      : sliderValue > 0
        ? currentPair?.imageB.id ?? null
        : null;

  const handleNext = useCallback(async () => {
    if (!survey || !currentPair) return;

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
      if (winnerId) {
        formData.append("winnerId", winnerId);
      }
      formData.append("score", String(sliderValue));

      if (finalAudio && finalAudio.size > 0) {
        const ext = finalAudio.type.includes("mp4") ? ".mp4" : ".webm";
        formData.append("audio", finalAudio, `recording${ext}`);
      }

      const res = await fetch(
        `/api/surveys/${survey.id}/pairwise-responses`,
        { method: "POST", body: formData }
      );

      if (!res.ok) {
        throw new Error("Failed to submit response");
      }

      if (currentIndex + 1 >= pairs.length) {
        router.push(`/s/${params.code}/done`);
      } else {
        setCurrentIndex((prev) => prev + 1);
        setSliderValue(0);
      }
    } catch {
      setError("submit_error");
    } finally {
      setSubmitting(false);
    }
  }, [
    survey,
    currentPair,
    winnerId,
    sliderValue,
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

  if (error || !survey || !currentPair) {
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

  const preferA = sliderValue < 0;
  const preferB = sliderValue > 0;

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
        <div
          className={`relative flex-1 overflow-hidden rounded-xl border-3 transition-all ${
            preferA
              ? "border-blue-500 shadow-lg shadow-blue-500/20"
              : "border-transparent"
          }`}
        >
          <img
            src={`/api/uploads?file=${encodeURIComponent(currentPair.imageA.filename)}`}
            alt={currentPair.imageA.label || "Image A"}
            className="max-h-[40dvh] sm:max-h-[50dvh] w-full object-contain"
          />
          {currentPair.imageA.label && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6">
              <span className="text-sm font-medium text-white">{currentPair.imageA.label}</span>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="flex flex-col items-center gap-1 text-zinc-300 dark:text-zinc-600">
          <span className="text-xs font-bold">{t(lang, "compare.vs")}</span>
        </div>

        {/* Image B */}
        <div
          className={`relative flex-1 overflow-hidden rounded-xl border-3 transition-all ${
            preferB
              ? "border-blue-500 shadow-lg shadow-blue-500/20"
              : "border-transparent"
          }`}
        >
          <img
            src={`/api/uploads?file=${encodeURIComponent(currentPair.imageB.filename)}`}
            alt={currentPair.imageB.label || "Image B"}
            className="max-h-[40dvh] sm:max-h-[50dvh] w-full object-contain"
          />
          {currentPair.imageB.label && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6">
              <span className="text-sm font-medium text-white">{currentPair.imageB.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* Slider */}
      <div className="mx-auto w-full max-w-lg px-6 pt-2 pb-1">
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={sliderValue}
          onChange={(e) => setSliderValue(Number(e.target.value))}
          className="slider-compare w-full"
        />
        <div className="mt-1 flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
          <span>{t(lang, "compare.stronglyPrefer")}</span>
          <span>{t(lang, "compare.stronglyPrefer")}</span>
        </div>
      </div>

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
          disabled={submitting}
          className="h-14 w-full max-w-xs rounded-2xl bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
        >
          {submitting
            ? t(lang, "eval.submitting")
            : sliderValue === 0
              ? t(lang, "compare.noPreference")
              : currentIndex + 1 >= pairs.length
                ? t(lang, "eval.finish")
                : t(lang, "eval.next")}
        </button>
      </div>
    </div>
  );
}
