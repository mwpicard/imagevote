"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAudioRecorder } from "@/components/useAudioRecorder";
import { t, type Locale } from "@/lib/i18n";

interface Survey {
  id: string;
  outroHeading: string;
  outroBody: string;
  outroMediaFilename: string | null;
  outroAudioFilename: string | null;
  narrationTiming: string;
  betaPrice: string | null;
  language: string;
  code: string;
  images: { id: string; filename: string; label: string | null }[];
}

interface Favourite {
  id: string;
  filename: string;
  label: string | null;
}

export default function DonePage() {
  const params = useParams<{ code: string }>();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [favourites, setFavourites] = useState<Favourite[]>([]);
  const [favouritesLoaded, setFavouritesLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [orderSubmitted, setOrderSubmitted] = useState(false);
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [betaOfferDismissed, setBetaOfferDismissed] = useState(false);
  const narrationRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const { isRecording, audioBlob, startRecording, stopRecording } =
    useAudioRecorder();

  const participantId =
    typeof window !== "undefined"
      ? localStorage.getItem(`imagevote-participant-${params.code}`) ?? ""
      : "";

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await fetch(`/api/surveys/by-code/${params.code}`);
        if (!res.ok) {
          setError("not_found");
          return;
        }
        const data = await res.json();
        setSurvey(data);
      } catch {
        setError("load_error");
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, [params.code]);

  // Fetch favourites once survey is loaded
  useEffect(() => {
    if (!survey || !participantId) return;

    async function fetchFavourites() {
      try {
        const res = await fetch(
          `/api/surveys/${survey!.id}/my-favourites?participantId=${encodeURIComponent(participantId)}`
        );
        if (res.ok) {
          const data = await res.json();
          setFavourites(data.favourites ?? []);
        }
      } catch {
        // Silently fail — favourites are a nice-to-have
      } finally {
        setFavouritesLoaded(true);
      }
    }

    fetchFavourites();
  }, [survey, participantId]);

  const lang = (
    (typeof window !== "undefined"
      ? localStorage.getItem(`imagevote-lang-${params.code}`)
      : null) || survey?.language || "en"
  ) as Locale;

  const audioConsent =
    typeof window !== "undefined"
      ? localStorage.getItem(`imagevote-audio-consent-${params.code}`) === "true"
      : false;

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Play outro narration audio — triggered on first user interaction if autoplay blocked
  useEffect(() => {
    if (!survey?.outroAudioFilename) return;

    const audioUrl = `/api/uploads?file=${encodeURIComponent(survey.outroAudioFilename)}`;
    const audio = new Audio(audioUrl);
    narrationRef.current = audio;

    const hasVideo = !!survey.outroMediaFilename && /\.(mp4|webm|mov)$/i.test(survey.outroMediaFilename);
    const timing = survey.narrationTiming;

    function startNarration() {
      if (timing === "after" && hasVideo && videoRef.current) {
        const video = videoRef.current;
        video.loop = false;
        const onEnded = () => {
          audio.play().catch(() => {});
          video.removeEventListener("ended", onEnded);
        };
        video.addEventListener("ended", onEnded);
      } else if (timing === "after" && !hasVideo) {
        setTimeout(() => audio.play().catch(() => {}), 1500);
      } else {
        audio.play().catch(() => {});
      }
    }

    const playPromise = audio.play();
    if (playPromise) {
      playPromise.then(() => {
        if (timing === "after") {
          audio.pause();
          audio.currentTime = 0;
          startNarration();
        }
      }).catch(() => {
        function onInteraction() {
          startNarration();
          document.removeEventListener("click", onInteraction);
          document.removeEventListener("touchstart", onInteraction);
        }
        document.addEventListener("click", onInteraction, { once: true });
        document.addEventListener("touchstart", onInteraction, { once: true });
      });
    }

    return () => {
      audio.pause();
      narrationRef.current = null;
    };
  }, [survey]);

  async function handleMicToggle() {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  }

  async function handleSubmitRecording() {
    if (!survey || !audioBlob || audioBlob.size === 0) return;

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("participantId", participantId);
      const ext = audioBlob.type.includes("mp4") ? ".mp4" : ".webm";
      formData.append("audio", audioBlob, `outro-recording${ext}`);

      const res = await fetch(
        `/api/surveys/${survey.id}/outro-recording`,
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

  async function handleSubmitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!survey || !email.trim()) return;

    const imageIds = favourites.length > 0
      ? favourites.map((f) => f.id)
      : survey.images.map((img) => img.id);
    if (imageIds.length === 0) return;

    setOrderSubmitting(true);
    try {
      const res = await fetch(`/api/surveys/${survey.id}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId,
          email: email.trim(),
          imageIds,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit order");
      setOrderSubmitted(true);
    } catch {
      // Keep form visible so user can retry
    } finally {
      setOrderSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-white dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-600" />
      </div>
    );
  }

  if (error || !survey) {
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

  const hasMedia = !!survey.outroMediaFilename;
  const isOutroVideo = hasMedia && /\.(mp4|webm|mov)$/i.test(survey.outroMediaFilename!);
  const hasFavourites = favouritesLoaded && favourites.length > 0;
  // If no direct favourites, show all survey images as fallback
  const displayImages: Favourite[] = hasFavourites
    ? favourites
    : survey.images.map((img) => ({ id: img.id, filename: img.filename, label: img.label }));
  const plural = displayImages.length > 1;

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-white px-6 dark:bg-zinc-950">
      {/* Beta offer popup */}
      {survey.betaPrice && !betaOfferDismissed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl dark:bg-zinc-900">
            <p className="text-lg leading-relaxed text-zinc-800 dark:text-zinc-100">
              {t(lang, "done.betaOfferMessage", { price: survey.betaPrice })}
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={() => setBetaOfferDismissed(true)}
                className="h-12 w-full rounded-xl bg-zinc-900 text-base font-semibold text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {t(lang, "done.betaOfferAccept")}
              </button>
              <button
                onClick={() => setBetaOfferDismissed(true)}
                className="h-12 w-full rounded-xl border border-zinc-200 text-base font-medium text-zinc-500 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                {t(lang, "done.betaOfferDecline")}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Background media */}
      {hasMedia && (
        isOutroVideo ? (
          <video
            ref={videoRef}
            src={`/api/uploads?file=${encodeURIComponent(survey.outroMediaFilename!)}`}
            autoPlay
            loop={!(survey.narrationTiming === "after" && survey.outroAudioFilename)}
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <img
            src={`/api/uploads?file=${encodeURIComponent(survey.outroMediaFilename!)}`}
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
          {survey.outroHeading}
        </h1>

        <p className={`mt-6 text-lg leading-relaxed ${hasMedia ? "text-white/80" : "text-zinc-600 dark:text-zinc-400"}`}>
          {survey.outroBody}
        </p>

        {/* Favourites / images section */}
        {favouritesLoaded && displayImages.length > 0 && (
          <div className="mt-8 flex w-full flex-col items-center gap-4">
            {hasFavourites && (
              <h2 className={`text-lg font-semibold ${hasMedia ? "text-white" : "text-zinc-800 dark:text-zinc-200"}`}>
                {t(lang, plural ? "done.yourFavourites" : "done.yourFavourite")}
              </h2>
            )}

            <div className="flex flex-wrap justify-center gap-3">
              {displayImages.map((img) => (
                <div key={img.id} className="flex flex-col items-center gap-1">
                  <img
                    src={`/api/uploads?file=${encodeURIComponent(img.filename)}`}
                    alt={img.label || ""}
                    className="h-32 w-32 rounded-xl object-cover shadow-lg sm:h-40 sm:w-40"
                  />
                  {img.label && (
                    <span className={`text-xs font-medium ${hasMedia ? "text-white/70" : "text-zinc-500 dark:text-zinc-400"}`}>
                      {img.label}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Order CTA */}
            {!orderSubmitted ? (
              <form onSubmit={handleSubmitOrder} className="mt-2 flex w-full max-w-sm flex-col items-center gap-3">
                <p className={`text-sm ${hasMedia ? "text-white/70" : "text-zinc-500 dark:text-zinc-400"}`}>
                  {t(lang, plural ? "done.wantToOrderPlural" : "done.wantToOrder")}
                </p>
                <div className="flex w-full gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t(lang, "done.enterEmail")}
                    className={`h-12 flex-1 rounded-xl border px-4 text-sm outline-none transition-colors ${
                      hasMedia
                        ? "border-white/30 bg-white/10 text-white placeholder:text-white/40 focus:border-white/60"
                        : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
                    }`}
                  />
                  <button
                    type="submit"
                    disabled={orderSubmitting}
                    className={`h-12 rounded-xl px-6 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      hasMedia
                        ? "bg-white text-zinc-900 hover:bg-white/90 active:bg-white/80"
                        : "bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
                    }`}
                  >
                    {t(lang, "done.submitOrder")}
                  </button>
                </div>
              </form>
            ) : (
              <p className={`mt-2 text-sm font-medium ${hasMedia ? "text-green-300" : "text-green-600 dark:text-green-400"}`}>
                {t(lang, "done.orderConfirmation")}
              </p>
            )}
          </div>
        )}

        {/* Record final thoughts */}
        {!submitted && audioConsent && (
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
