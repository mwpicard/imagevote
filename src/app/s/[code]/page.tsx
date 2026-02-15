"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { t, LOCALES, type Locale } from "@/lib/i18n";

interface Survey {
  id: string;
  title: string;
  introHeading: string;
  introBody: string;
  introHeadingEs: string | null;
  introHeadingCa: string | null;
  introBodyEs: string | null;
  introBodyCa: string | null;
  introMediaFilename: string | null;
  introAudioFilename: string | null;
  introAudioFilenameEs: string | null;
  introAudioFilenameCa: string | null;
  narrationTiming: string;
  outroHeading: string;
  outroBody: string;
  outroMediaFilename: string | null;
  votingMode: "binary" | "scale" | "pairwise" | "guided_tour";
  language: string;
  randomizeOrder: boolean;
  code: string;
  images: { id: string }[];
}

function localized(survey: Survey, field: "introHeading" | "introBody", lang: string): string {
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

export default function IntroPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Locale>("en");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [audioConsent, setAudioConsent] = useState<boolean | null>(null);
  const [nameError, setNameError] = useState(false);
  const [starting, setStarting] = useState(false);
  const narrationRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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
        const stored = localStorage.getItem(`imagevote-lang-${params.code}`);
        setLang((stored || data.language || "en") as Locale);
      } catch {
        setError("load_error");
      } finally {
        setLoading(false);
      }
    }

    fetchSession();
  }, [params.code]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Play intro narration audio — triggered on first user interaction
  // (browsers block autoplay of audio with sound without a gesture)
  useEffect(() => {
    const audioFile = lang === "es" && survey?.introAudioFilenameEs
      ? survey.introAudioFilenameEs
      : lang === "ca" && survey?.introAudioFilenameCa
        ? survey.introAudioFilenameCa
        : survey?.introAudioFilename;
    if (!audioFile || !survey) return;

    const audioUrl = `/api/uploads?file=${encodeURIComponent(audioFile)}`;
    const audio = new Audio(audioUrl);
    narrationRef.current = audio;

    const hasVideo = !!survey.introMediaFilename && /\.(mp4|webm|mov)$/i.test(survey.introMediaFilename);
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

    // Try to play immediately (works if user navigated via link click)
    const playPromise = audio.play();
    if (playPromise) {
      playPromise.then(() => {
        // Autoplay succeeded — if timing is "after", pause and set up properly
        if (timing === "after") {
          audio.pause();
          audio.currentTime = 0;
          startNarration();
        }
      }).catch(() => {
        // Autoplay blocked — wait for first user interaction
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

  function handleLanguageChange(newLang: Locale) {
    setLang(newLang);
    localStorage.setItem(`imagevote-lang-${params.code}`, newLang);
  }

  async function handleStart() {
    if (!firstName.trim()) {
      setNameError(true);
      return;
    }
    if (!survey) return;

    setStarting(true);
    try {
      const res = await fetch(`/api/surveys/${survey.id}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          age: age ? Number(age) : undefined,
        }),
      });

      if (!res.ok) throw new Error("Failed to create participant");

      const data = await res.json();
      localStorage.setItem(`imagevote-participant-${params.code}`, data.id);
      localStorage.setItem(`imagevote-audio-consent-${params.code}`, JSON.stringify(audioConsent === true));
      router.push(
        survey.votingMode === "pairwise"
          ? `/s/${params.code}/compare`
          : `/s/${params.code}/evaluate`
      );
    } catch {
      setError("load_error");
      setStarting(false);
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

  const hasMedia = !!survey.introMediaFilename;
  const isVideo = hasMedia && /\.(mp4|webm|mov)$/i.test(survey.introMediaFilename!);

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-white px-6 dark:bg-zinc-950">
      {/* Background media */}
      {hasMedia && (
        isVideo ? (
          <video
            ref={videoRef}
            src={`/api/uploads?file=${encodeURIComponent(survey.introMediaFilename!)}`}
            autoPlay
            loop={!(survey.narrationTiming === "after" && survey.introAudioFilename)}
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <img
            src={`/api/uploads?file=${encodeURIComponent(survey.introMediaFilename!)}`}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )
      )}
      {hasMedia && <div className="absolute inset-0 bg-black/50" />}

      <div className={`relative z-10 flex w-full max-w-lg flex-col items-center text-center ${hasMedia ? "text-white" : ""}`}>
        <h1 className={`text-4xl font-bold leading-tight tracking-tight sm:text-5xl ${hasMedia ? "text-white" : "text-zinc-900 dark:text-zinc-50"}`}>
          {localized(survey, "introHeading", lang)}
        </h1>

        <p className={`mt-6 text-lg leading-relaxed ${hasMedia ? "text-white/80" : "text-zinc-600 dark:text-zinc-400"}`}>
          {localized(survey, "introBody", lang)}
        </p>

        <p className={`mt-8 text-sm font-medium ${hasMedia ? "text-white/60" : "text-zinc-400 dark:text-zinc-500"}`}>
          {survey.votingMode === "guided_tour"
            ? t(lang, "intro.guidedTourCount", {
                count: survey.images.length,
                plural: survey.images.length !== 1 ? "s" : "",
                pairs: (survey.images.length * (survey.images.length - 1)) / 2,
              })
            : t(lang, "intro.imageCount", {
                count: survey.images.length,
                plural: survey.images.length !== 1 ? "s" : "",
              })}
        </p>

        {/* Language picker */}
        <div className="mt-8 flex items-center gap-1.5">
          {LOCALES.map((l) => (
            <button
              key={l.value}
              onClick={() => handleLanguageChange(l.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                lang === l.value
                  ? hasMedia
                    ? "bg-white text-zinc-900"
                    : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : hasMedia
                    ? "bg-white/20 text-white hover:bg-white/30"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        {/* Name fields */}
        <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
          <div>
            <input
              type="text"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (nameError) setNameError(false);
              }}
              placeholder={t(lang, "intro.firstName")}
              className={`h-12 w-full rounded-xl border px-4 text-sm outline-none transition-colors ${
                hasMedia
                  ? "border-white/30 bg-white/10 text-white placeholder:text-white/40 focus:border-white/60"
                  : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
              } ${nameError ? "border-red-400 dark:border-red-500" : ""}`}
            />
            {nameError && (
              <p className="mt-1 text-xs text-red-500">
                {t(lang, "intro.firstNameRequired")}
              </p>
            )}
          </div>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder={t(lang, "intro.lastName")}
            className={`h-12 w-full rounded-xl border px-4 text-sm outline-none transition-colors ${
              hasMedia
                ? "border-white/30 bg-white/10 text-white placeholder:text-white/40 focus:border-white/60"
                : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
            }`}
          />
          <input
            type="number"
            inputMode="numeric"
            min="1"
            max="120"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder={t(lang, "intro.age")}
            className={`h-12 w-full rounded-xl border px-4 text-sm outline-none transition-colors ${
              hasMedia
                ? "border-white/30 bg-white/10 text-white placeholder:text-white/40 focus:border-white/60"
                : "border-zinc-200 bg-white text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500"
            }`}
          />
        </div>

        {/* Audio consent */}
        <div className="mt-6 flex w-full max-w-xs flex-col items-center gap-2">
          <p className={`text-sm text-center ${hasMedia ? "text-white/70" : "text-zinc-500 dark:text-zinc-400"}`}>
            {t(lang, "intro.audioConsent")}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAudioConsent(true)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                audioConsent === true
                  ? hasMedia
                    ? "bg-white text-zinc-900"
                    : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : hasMedia
                    ? "bg-white/20 text-white hover:bg-white/30"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {t(lang, "intro.audioYes")}
            </button>
            <button
              type="button"
              onClick={() => setAudioConsent(false)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                audioConsent === false
                  ? hasMedia
                    ? "bg-white text-zinc-900"
                    : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : hasMedia
                    ? "bg-white/20 text-white hover:bg-white/30"
                    : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
              }`}
            >
              {t(lang, "intro.audioNo")}
            </button>
          </div>
        </div>

        <button
          onClick={handleStart}
          disabled={starting}
          className={`mt-6 h-14 w-full max-w-xs rounded-2xl text-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            hasMedia
              ? "bg-white text-zinc-900 hover:bg-white/90 active:bg-white/80"
              : "bg-zinc-900 text-white hover:bg-zinc-800 active:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:active:bg-zinc-300"
          }`}
        >
          {starting ? t(lang, "eval.submitting") : t(lang, "intro.start")}
        </button>
      </div>
    </div>
  );
}
