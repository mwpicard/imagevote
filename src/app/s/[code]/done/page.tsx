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
  const [finalText, setFinalText] = useState("");

  const [favourites, setFavourites] = useState<Favourite[]>([]);
  const [favouritesLoaded, setFavouritesLoaded] = useState(false);
  const [email, setEmail] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [betaSubmitted, setBetaSubmitted] = useState(false);
  const [preorderSubmitted, setPreorderSubmitted] = useState(false);
  const [ctaSubmitting, setCtaSubmitting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
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

  async function handleDone() {
    if (!survey) return;
    const hasAudio = audioBlob && audioBlob.size > 0;
    const hasText = finalText.trim().length > 0;

    if (!hasAudio && !hasText) {
      setShowModal(true);
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("participantId", participantId);
      if (hasAudio) {
        const ext = audioBlob!.type.includes("mp4") ? ".mp4" : ".webm";
        formData.append("audio", audioBlob!, `outro-recording${ext}`);
      }
      if (hasText) {
        formData.append("transcription", finalText.trim());
      }

      const res = await fetch(
        `/api/surveys/${survey.id}/outro-recording`,
        { method: "POST", body: formData }
      );

      if (!res.ok) throw new Error("Failed to submit");
      setSubmitted(true);
      setShowModal(true);
    } catch {
      setError("submit_error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCtaSubmit(type: "beta" | "preorder") {
    if (!survey || !email.trim()) return;

    const imageIds = favourites.length > 0
      ? favourites.map((f) => f.id)
      : survey.images.map((img) => img.id);

    setCtaSubmitting(true);
    try {
      const res = await fetch(`/api/surveys/${survey.id}/order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId,
          email: email.trim(),
          imageIds: imageIds.length > 0 ? imageIds : [],
          type,
        }),
      });

      if (!res.ok) throw new Error("Failed to submit");
      if (type === "beta") setBetaSubmitted(true);
      else setPreorderSubmitted(true);
      setEmail("");
    } catch {
      // Keep form visible so user can retry
    } finally {
      setCtaSubmitting(false);
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
  const allImages: Favourite[] = hasFavourites
    ? favourites
    : survey.images.map((img) => ({ id: img.id, filename: img.filename, label: img.label }));
  const displayImages = allImages.slice(0, 3);
  const plural = displayImages.length > 1;

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-white px-6 dark:bg-zinc-950">
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

        {/* Ranked images */}
        {favouritesLoaded && displayImages.length > 0 && (
          <div className="mt-8 flex w-full flex-col items-center gap-4">
            {hasFavourites && (
              <h2 className={`text-lg font-semibold ${hasMedia ? "text-white" : "text-zinc-800 dark:text-zinc-200"}`}>
                {t(lang, plural ? "done.yourFavourites" : "done.yourFavourite")}
              </h2>
            )}
            <div className="flex flex-wrap justify-center gap-4">
              {displayImages.map((img, i) => (
                <div key={img.id} className="relative flex flex-col items-center gap-1">
                  <div className="relative">
                    <img
                      src={`/api/uploads?file=${encodeURIComponent(img.filename)}`}
                      alt={img.label || ""}
                      className="h-32 w-32 rounded-xl object-cover shadow-lg sm:h-40 sm:w-40"
                    />
                    <div className={`absolute -top-3 -left-3 flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold shadow-md ${
                      i === 0
                        ? "bg-yellow-400 text-yellow-900"
                        : i === 1
                          ? "bg-zinc-300 text-zinc-700"
                          : i === 2
                            ? "bg-amber-600 text-white"
                            : hasMedia
                              ? "bg-white/20 text-white"
                              : "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                    }`}>
                      {i + 1}
                    </div>
                  </div>
                  {img.label && (
                    <span className={`text-xs font-medium ${hasMedia ? "text-white/70" : "text-zinc-500 dark:text-zinc-400"}`}>
                      {img.label}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Final thoughts — text input + mic */}
        {!submitted && (
          <div className="mt-8 flex w-full max-w-sm flex-col items-center gap-3">
            <p className={`text-sm font-medium ${hasMedia ? "text-white/60" : "text-zinc-400 dark:text-zinc-500"}`}>
              {t(lang, "done.finalThoughts")}
            </p>
            <div className="flex w-full items-center gap-2">
              <input
                type="text"
                value={finalText}
                onChange={(e) => setFinalText(e.target.value)}
                placeholder={t(lang, "done.finalThoughtsPlaceholder")}
                className={`h-12 flex-1 rounded-xl border px-4 text-sm outline-none transition-colors ${
                  hasMedia
                    ? "border-white/30 bg-white/10 text-white placeholder:text-white/40 focus:border-white/60"
                    : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                }`}
              />
              {audioConsent && (
                <button
                  onClick={handleMicToggle}
                  className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl transition-all ${
                    isRecording
                      ? "animate-pulse bg-red-500 text-white"
                      : hasMedia
                        ? "bg-white/20 text-white hover:bg-white/30"
                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                  }`}
                  aria-label={isRecording ? "Stop recording" : "Record final thoughts"}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                    <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Z" />
                    <path d="M6 11a1 1 0 1 0-2 0 8 8 0 0 0 7 7.93V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-2.07A8 8 0 0 0 20 11a1 1 0 1 0-2 0 6 6 0 0 1-12 0Z" />
                  </svg>
                </button>
              )}
            </div>
            {isRecording && (
              <span className="text-xs font-medium text-red-500">{t(lang, "eval.recording")}</span>
            )}
            {!isRecording && audioBlob && audioBlob.size > 0 && (
              <span className={`text-xs font-medium ${hasMedia ? "text-white/60" : "text-zinc-400 dark:text-zinc-500"}`}>
                {t(lang, "eval.audioRecorded")}
              </span>
            )}
          </div>
        )}

        {submitted && (
          <p className={`mt-6 text-sm font-medium ${hasMedia ? "text-green-300" : "text-green-600 dark:text-green-400"}`}>
            {t(lang, "done.confirmation")}
          </p>
        )}

        {/* DONE button */}
        {!showModal && (
          <button
            onClick={handleDone}
            disabled={submitting}
            className={`mt-8 h-14 w-full max-w-sm rounded-2xl text-lg font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              hasMedia
                ? "bg-white text-zinc-900 hover:bg-white/90 active:bg-white/80"
                : "bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            }`}
          >
            {submitting ? t(lang, "done.submitting") : t(lang, "done.doneButton")}
          </button>
        )}

        {/* CTA Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
              <h2 className="text-center text-xl font-bold text-zinc-900 dark:text-zinc-50">
                {t(lang, "done.modalTitle")}
              </h2>

              {/* Email input — shared across CTAs */}
              <div className="mt-5">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t(lang, "done.enterEmail")}
                  className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                />
              </div>

              <div className="mt-4 flex flex-col gap-2.5">
                {/* 1. Beta testers */}
                {betaSubmitted ? (
                  <div className="flex h-14 items-center justify-center rounded-xl bg-green-50 text-sm font-medium text-green-600 dark:bg-green-950 dark:text-green-400">
                    {t(lang, "done.ctaBetaSuccess")}
                  </div>
                ) : (
                  <button
                    onClick={() => handleCtaSubmit("beta")}
                    disabled={ctaSubmitting || !email.trim()}
                    className="h-14 w-full rounded-xl border-2 border-zinc-900 bg-zinc-900 text-base font-semibold text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    {t(lang, "done.ctaBeta")}
                  </button>
                )}

                {/* 2. Pre-order */}
                {survey.betaPrice && (
                  preorderSubmitted ? (
                    <div className="flex h-14 items-center justify-center rounded-xl bg-green-50 text-sm font-medium text-green-600 dark:bg-green-950 dark:text-green-400">
                      {t(lang, "done.ctaPreorderSuccess")}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleCtaSubmit("preorder")}
                      disabled={ctaSubmitting || !email.trim()}
                      className="h-14 w-full rounded-xl border-2 border-blue-600 bg-blue-600 text-base font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <span>{t(lang, "done.ctaPreorder")}</span>
                      <span className="ml-1 text-sm font-normal opacity-80">({survey.betaPrice})</span>
                    </button>
                  )
                )}

                {/* 3. Share */}
                {(() => {
                  const trackingUrl = `${window.location.origin}/s/${survey.code}?ref=${encodeURIComponent(participantId)}`;
                  const waMessage = t(lang, "done.shareWhatsAppMessage", { url: trackingUrl });
                  return (
                    <>
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(waMessage)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#25D366] bg-[#25D366] text-base font-semibold text-white transition-colors hover:bg-[#20bd5a] active:bg-[#1da851]"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                        </svg>
                        {t(lang, "done.ctaShare")}
                      </a>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(trackingUrl);
                          setLinkCopied(true);
                          setTimeout(() => setLinkCopied(false), 2000);
                        }}
                        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-zinc-200 text-base font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 active:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        {linkCopied ? (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 text-green-500">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {t(lang, "done.shareLinkCopied")}
                          </>
                        ) : (
                          <>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                            {t(lang, "done.shareCopyLink")}
                          </>
                        )}
                      </button>
                    </>
                  );
                })()}
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="mt-4 w-full text-center text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                {t(lang, "done.closeTab")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
