"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAudioRecorder } from "@/components/useAudioRecorder";
import { t, type Locale } from "@/lib/i18n";

interface Survey {
  id: string;
  outroHeading: string;
  outroBody: string;
  outroHeadingEs: string | null;
  outroHeadingCa: string | null;
  outroBodyEs: string | null;
  outroBodyCa: string | null;
  outroMediaFilename: string | null;
  outroAudioFilename: string | null;
  outroAudioFilenameEs: string | null;
  outroAudioFilenameCa: string | null;
  narrationTiming: string;
  betaPrice: string | null;
  preorderUrl: string | null;
  language: string;
  code: string;
  images: { id: string; filename: string; label: string | null }[];
}

function localized(survey: Survey, field: "outroHeading" | "outroBody", lang: string): string {
  if (lang === "es") {
    const key = (field + "Es") as keyof Survey;
    return (survey[key] as string) || survey[field];
  }
  if (lang === "ca") {
    const key = (field + "Ca") as keyof Survey;
    return (survey[key] as string) || survey[field];
  }
  return survey[field];
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
  const [preorderSubmitted, setPreorderSubmitted] = useState(false);
  const [ctaSubmitting, setCtaSubmitting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [couponCode, setCouponCode] = useState<string | null>(null);
  const [couponCopied, setCouponCopied] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [showReferral, setShowReferral] = useState(false);
  const [referralLinkCopied, setReferralLinkCopied] = useState(false);
  const narrationRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const inputFocusedRef = useRef(false);

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

  // Show referral prompt when user returns to tab after visiting the shop
  useEffect(() => {
    if (!preorderSubmitted) return;

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        setShowReferral(true);
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [preorderSubmitted]);

  // Auto-show CTA modal after 7s of inactivity (not typing, not recording)
  useEffect(() => {
    if (!survey || showModal || submitted || submitting) return;

    const timer = setTimeout(() => {
      if (!inputFocusedRef.current && !isRecording) {
        setShowModal(true);
      }
    }, 7000);

    return () => clearTimeout(timer);
  }, [survey, showModal, submitted, submitting, isRecording, finalText]);

  // Play outro narration audio — triggered on first user interaction if autoplay blocked
  useEffect(() => {
    const audioFile = lang === "es" && survey?.outroAudioFilenameEs
      ? survey.outroAudioFilenameEs
      : lang === "ca" && survey?.outroAudioFilenameCa
        ? survey.outroAudioFilenameCa
        : survey?.outroAudioFilename;
    if (!audioFile || !survey) return;

    const audioUrl = `/api/uploads?file=${encodeURIComponent(audioFile)}`;
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
  }, [survey, lang]);

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

  async function handlePreorder() {
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
          type: "preorder",
        }),
      });

      if (!res.ok) throw new Error("Failed to submit");
      const data = await res.json();
      const trimmedEmail = email.trim();
      setPreorderSubmitted(true);
      setSubmittedEmail(trimmedEmail);
      if (data.coupon) {
        setCouponCode(data.coupon);
      }

      // Open store in new tab (old tab stays open with coupon visible)
      const storeUrl = new URL(survey.preorderUrl || "https://dormy.re/shop.html");
      storeUrl.searchParams.set("email", trimmedEmail);
      if (data.coupon) storeUrl.searchParams.set("coupon", data.coupon);
      window.open(storeUrl.toString(), "_blank");

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
          {localized(survey, "outroHeading", lang)}
        </h1>

        <p className={`mt-6 text-lg leading-relaxed ${hasMedia ? "text-white/80" : "text-zinc-600 dark:text-zinc-400"}`}>
          {localized(survey, "outroBody", lang)}
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
                onFocus={() => { inputFocusedRef.current = true; }}
                onBlur={() => { inputFocusedRef.current = false; }}
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
              {/* Pre-order: email form or coupon card */}
              {survey.betaPrice && !preorderSubmitted && (
                <>
                  <h2 className="text-center text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {t(lang, "done.modalTitle")}
                  </h2>
                  <p className="mt-2 text-center text-base text-zinc-500 dark:text-zinc-400">
                    {t(lang, "done.emailForDiscount")}
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (email.trim()) handlePreorder();
                    }}
                    className="mt-5 flex flex-col gap-3"
                  >
                    <input
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="h-12 w-full rounded-xl border border-zinc-200 bg-white px-4 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500"
                    />
                    <button
                      type="submit"
                      disabled={ctaSubmitting}
                      className="h-14 w-full rounded-xl bg-blue-600 text-base font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {t(lang, "done.getDiscount")}
                    </button>
                  </form>
                </>
              )}

              {/* Coupon card — shown after preorder, tab stays open */}
              {preorderSubmitted && couponCode && (
                <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-blue-200 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-950">
                  <h3 className="text-lg font-bold text-blue-700 dark:text-blue-300">
                    {t(lang, "done.couponTitle")}
                  </h3>
                  <div className="flex w-full items-center gap-2">
                    <code className="flex-1 rounded-lg border-2 border-dashed border-blue-300 bg-white px-4 py-3 text-center text-lg font-bold tracking-widest text-blue-800 dark:border-blue-600 dark:bg-zinc-900 dark:text-blue-200">
                      {couponCode}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(couponCode);
                        setCouponCopied(true);
                        setTimeout(() => setCouponCopied(false), 2000);
                      }}
                      className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
                      aria-label="Copy coupon"
                    >
                      {couponCopied ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
                  </div>
                  {couponCopied && (
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                      {t(lang, "done.couponCopied")}
                    </span>
                  )}
                  <a
                    href={(() => {
                      const url = new URL(survey.preorderUrl || "https://dormy.re/shop.html");
                      url.searchParams.set("email", submittedEmail);
                      url.searchParams.set("coupon", couponCode);
                      return url.toString();
                    })()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex h-12 w-full items-center justify-center rounded-xl bg-blue-600 text-base font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
                  >
                    {t(lang, "done.couponGoToShop")} &rarr;
                  </a>
                </div>
              )}

              {preorderSubmitted && !couponCode && (
                <div className="flex h-14 items-center justify-center rounded-xl bg-green-50 text-sm font-medium text-green-600 dark:bg-green-950 dark:text-green-400">
                  {t(lang, "done.ctaPreorderSuccess")}
                </div>
              )}

              {/* No betaPrice — just show title */}
              {!survey.betaPrice && !preorderSubmitted && (
                <h2 className="text-center text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                  {t(lang, "done.closeTab")}
                </h2>
              )}

              {/* Referral prompt — shown when user returns from shop */}
              {showReferral && preorderSubmitted && (
                <div className="mt-5 rounded-xl border-2 border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
                  <h3 className="text-center text-base font-bold text-green-800 dark:text-green-200">
                    {t(lang, "done.referralTitle")}
                  </h3>
                  <p className="mt-1 text-center text-sm text-green-600 dark:text-green-400">
                    {t(lang, "done.referralBody")}
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    {(() => {
                      const shareUrl = `${window.location.origin}/s/${survey.code}`;
                      const whatsappMsg = t(lang, "done.referralWhatsApp", { url: shareUrl });
                      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMsg)}`;
                      return (
                        <>
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-600 text-base font-semibold text-white transition-colors hover:bg-green-700 active:bg-green-800"
                          >
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            {t(lang, "done.shareWhatsApp")}
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(shareUrl);
                              setReferralLinkCopied(true);
                              setTimeout(() => setReferralLinkCopied(false), 2000);
                            }}
                            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-green-300 text-base font-semibold text-green-700 transition-colors hover:bg-green-100 active:bg-green-200 dark:border-green-600 dark:text-green-300 dark:hover:bg-green-900"
                          >
                            {referralLinkCopied ? (
                              <>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
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
                </div>
              )}

              {/* Copy survey link */}
              <div className="mt-5">
                {(() => {
                  const trackingUrl = `${window.location.origin}/s/${survey.code}?ref=${encodeURIComponent(participantId)}`;
                  return (
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
