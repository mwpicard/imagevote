"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAudioRecorder } from "@/components/useAudioRecorder";
import { t, type Locale } from "@/lib/i18n";

interface ImageItem {
  id: string;
  filename: string;
  videoFilename: string | null;
  audioFilename: string | null;
  audioFilenameEs: string | null;
  audioFilenameCa: string | null;
  label: string | null;
  caption: string | null;
  captionEs: string | null;
  captionCa: string | null;
  sortOrder: number;
}

interface Survey {
  id: string;
  title: string;
  introHeading: string;
  introBody: string;
  outroHeading: string;
  outroBody: string;
  votingMode: "binary" | "scale" | "pairwise" | "guided_tour";
  language: string;
  randomizeOrder: boolean;
  autoRecord: boolean;
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

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [orderedImages, setOrderedImages] = useState<ImageItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [vote, setVote] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);

  const { isRecording, audioBlob, startRecording, stopRecording, clearAudio } =
    useAudioRecorder();

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch survey
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

        const imgs = data.randomizeOrder
          ? shuffleArray(data.images)
          : data.images;
        setOrderedImages(imgs);
      } catch {
        setError("load_error");
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

  const lang = (
    (typeof window !== "undefined"
      ? localStorage.getItem(`imagevote-lang-${params.code}`)
      : null) || survey?.language || "en"
  ) as Locale;

  const audioConsent =
    typeof window !== "undefined"
      ? localStorage.getItem(`imagevote-audio-consent-${params.code}`) === "true"
      : false;

  function localizedCaption(img: ImageItem): string | null {
    if (lang === "es" && img.captionEs) return img.captionEs;
    if (lang === "ca" && img.captionCa) return img.captionCa;
    return img.caption;
  }

  function localizedAudio(img: ImageItem): string | null {
    if (lang === "es" && img.audioFilenameEs) return img.audioFilenameEs;
    if (lang === "ca" && img.audioFilenameCa) return img.audioFilenameCa;
    return img.audioFilename;
  }

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Online/offline state
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Pre-request mic permission when autoRecord is enabled and consent given
  useEffect(() => {
    if (survey?.autoRecord && audioConsent) {
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((stream) => stream.getTracks().forEach((t) => t.stop()))
        .catch(() => {});
    }
  }, [survey?.autoRecord, audioConsent]);

  // Auto-play image audio + auto-record sequence
  useEffect(() => {
    if (!survey || !currentImage) return;

    let cancelled = false;

    async function runSequence() {
      // Step 1: Play image audio if present (localized)
      const audioFile = localizedAudio(currentImage!);
      if (audioFile) {
        setPlayingAudio(true);
        const audio = new Audio(
          `/api/uploads?file=${encodeURIComponent(audioFile)}`
        );
        audioRef.current = audio;

        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });

        audioRef.current = null;
        if (cancelled) return;
        setPlayingAudio(false);
      }

      // Step 2: Auto-start recording if autoRecord is on and consent given
      if (survey!.autoRecord && audioConsent && !cancelled) {
        await startRecording();
      }
    }

    runSequence();

    return () => {
      cancelled = true;
      // Pause any playing audio on cleanup
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingAudio(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, survey?.autoRecord, audioConsent]);

  const handleNext = useCallback(async () => {
    if (!survey || !currentImage || vote === null) return;

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

      const res = await fetch(`/api/surveys/${survey.id}/responses`, {
        method: "POST",
        body: formData,
      });

      // Accept both 200/201 (normal) and 202 (queued by service worker while offline)
      if (!res.ok && res.status !== 202) {
        throw new Error("Failed to submit response");
      }

      // Clear audio so it doesn't get re-submitted for the next image
      clearAudio();

      // Move to next image or done
      if (currentIndex + 1 >= orderedImages.length) {
        if (survey.votingMode === "guided_tour") {
          router.push(`/s/${params.code}/compare`);
        } else {
          router.push(`/s/${params.code}/done`);
        }
      } else {
        setCurrentIndex((prev) => prev + 1);
        setVote(null);
      }
    } catch {
      setError("submit_error");
    } finally {
      setSubmitting(false);
    }
  }, [
    survey,
    currentImage,
    vote,
    audioBlob,
    isRecording,
    stopRecording,
    clearAudio,
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

  if (error || !survey || !currentImage) {
    const errorMsg = error === "not_found"
      ? t(lang, "intro.sessionNotFound")
      : error === "load_error"
        ? t(lang, "intro.loadError")
        : error === "submit_error"
          ? t(lang, "eval.submitError")
          : t(lang, "eval.noImages");
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
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white">
          {t(lang, "eval.offline")}
        </div>
      )}

      {/* Progress bar */}
      <div className="flex flex-col items-center px-4 pt-4 pb-2">
        {survey.votingMode === "guided_tour" && (
          <span className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            {t(lang, "eval.phaseLabel")}
          </span>
        )}
        <span className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
          {t(lang, "eval.nOfM", { n: currentIndex + 1, total: orderedImages.length })}
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
      <div className="flex flex-1 flex-col items-center justify-center px-4 pt-4 pb-2">
        <img
          src={`/api/uploads?file=${encodeURIComponent(currentImage.filename)}`}
          alt={currentImage.label || `Image ${currentIndex + 1}`}
          className="evaluate-image max-h-[55dvh] w-full rounded-xl object-contain"
        />
        {localizedCaption(currentImage) && (
          <p className="mt-2 text-center text-base text-zinc-600 dark:text-zinc-400">
            {localizedCaption(currentImage)}
          </p>
        )}
      </div>

      {/* Controls area */}
      <div className="flex flex-col items-center gap-5 px-6 pb-8 pt-2">
        {/* Video link */}
        {currentImage.videoFilename && (
          <button
            onClick={() => setShowVideo(true)}
            className="text-sm font-medium text-zinc-400 underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:decoration-zinc-600 dark:hover:text-zinc-300"
          >
            {t(lang, "eval.seeVideo")}
          </button>
        )}

        {/* Voting controls */}
        <div className="flex items-center justify-center gap-3">
          {(survey.votingMode === "binary" || survey.votingMode === "guided_tour") && (
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

          {survey.votingMode === "scale" && (
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
                <span className="text-xs text-zinc-400 dark:text-zinc-500">{t(lang, "eval.scaleLow")}</span>
                <span className="text-xs text-zinc-400 dark:text-zinc-500">{t(lang, "eval.scaleHigh")}</span>
              </div>
            </div>
          )}

          {survey.votingMode === "pairwise" && (
            <button
              onClick={() => setVote(1)}
              className={`h-14 rounded-2xl border-2 px-8 text-base font-semibold transition-all ${
                vote === 1
                  ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-600"
              }`}
            >
              {t(lang, "eval.preferThis")}
            </button>
          )}
        </div>

        {/* Audio recording */}
        {audioConsent && (
          <div className="flex flex-col items-center gap-2">
            {survey.autoRecord ? (
              <>
                {playingAudio && (
                  <span className="text-xs font-medium text-blue-500">
                    {t(lang, "eval.playingAudio")}
                  </span>
                )}
                {isRecording && (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-red-500">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                    {t(lang, "eval.recording")}
                  </span>
                )}
                {!playingAudio && !isRecording && audioBlob && audioBlob.size > 0 && (
                  <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">
                    {t(lang, "eval.audioRecorded")}
                  </span>
                )}
              </>
            ) : (
              <>
                {playingAudio && (
                  <span className="text-xs font-medium text-blue-500">
                    {t(lang, "eval.playingAudio")}
                  </span>
                )}
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
              </>
            )}
          </div>
        )}

        {/* Next button */}
        <button
          onClick={handleNext}
          disabled={vote === null || submitting}
          className="h-14 w-full max-w-xs rounded-2xl bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
        >
          {submitting
            ? t(lang, "eval.submitting")
            : currentIndex + 1 >= orderedImages.length
              ? survey.votingMode === "guided_tour"
                ? t(lang, "eval.nextPhase")
                : t(lang, "eval.finish")
              : t(lang, "eval.next")}
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
