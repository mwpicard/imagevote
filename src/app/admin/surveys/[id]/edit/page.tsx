"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { LOCALES, type Locale } from "@/lib/i18n";
import { useAudioRecorder } from "@/components/useAudioRecorder";

interface ImageItem {
  id: string;
  filename: string;
  videoFilename: string | null;
  audioFilename: string | null;
  label: string | null;
  caption: string | null;
  sortOrder: number;
}

interface Survey {
  id: string;
  title: string;
  description: string | null;
  introHeading: string;
  introBody: string;
  introMediaFilename: string | null;
  outroHeading: string;
  outroBody: string;
  outroMediaFilename: string | null;
  votingMode: "binary" | "scale" | "pairwise" | "guided_tour";
  language: string;
  randomizeOrder: boolean;
  autoRecord: boolean;
  projectId: string | null;
  code: string;
  createdAt: string;
  images: ImageItem[];
}

function ImageRow({
  img,
  index,
  onDelete,
  onUpdate,
}: {
  img: ImageItem;
  index: number;
  onDelete: (id: string) => void;
  onUpdate: (id: string, caption: string, audio: File | null, removeAudio: boolean) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(img.caption || "");
  const [removeAudio, setRemoveAudio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const { isRecording, audioBlob, startRecording, stopRecording, clearAudio } =
    useAudioRecorder();

  // Sync when parent data changes (after save)
  useEffect(() => {
    setCaption(img.caption || "");
  }, [img.caption]);

  // Clean up audio element on unmount
  useEffect(() => {
    return () => {
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current = null;
      }
    };
  }, []);

  function blobToFile(blob: Blob): File {
    const ext = blob.type.includes("mp4") ? ".mp4" : ".webm";
    return new File([blob], `recording${ext}`, { type: blob.type });
  }

  async function handleSave() {
    setSaving(true);
    const file = audioBlob && audioBlob.size > 0 ? blobToFile(audioBlob) : null;
    await onUpdate(img.id, caption, file, removeAudio);
    clearAudio();
    setRemoveAudio(false);
    setSaving(false);
    setEditing(false);
  }

  function handleCancel() {
    setCaption(img.caption || "");
    clearAudio();
    setRemoveAudio(false);
    setEditing(false);
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current = null;
    }
    setPlaying(false);
  }

  function handleReview(src: string) {
    if (playing && audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current = null;
      setPlaying(false);
      return;
    }
    const audio = new Audio(src);
    audioElRef.current = audio;
    setPlaying(true);
    audio.onended = () => {
      audioElRef.current = null;
      setPlaying(false);
    };
    audio.play().catch(() => setPlaying(false));
  }

  function handleDeleteRecording() {
    clearAudio();
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current = null;
    }
    setPlaying(false);
  }

  // Has a new recording ready (not yet saved)
  const hasNewRecording = audioBlob && audioBlob.size > 0;
  // Has an existing saved audio on the server
  const hasExistingAudio = img.audioFilename && !removeAudio;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-sm font-semibold text-zinc-500">
          {index + 1}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/uploads?file=${img.filename}`}
          alt={img.label || `Image ${index + 1}`}
          className="h-16 w-16 flex-shrink-0 rounded-lg border border-zinc-200 object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900">
            {img.label || "No label"}
          </p>
          {!editing && img.caption && (
            <p className="mt-0.5 truncate text-sm text-zinc-500 italic">
              {img.caption}
            </p>
          )}
          <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
            {img.videoFilename && (
              <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                Video
              </span>
            )}
            {img.audioFilename && (
              <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                Audio
              </span>
            )}
            <span>Order: {img.sortOrder}</span>
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="flex h-9 items-center rounded-lg border border-zinc-200 px-3 text-sm text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
            >
              Edit
            </button>
          )}
          <button
            onClick={() => onDelete(img.id)}
            className="flex h-9 items-center rounded-lg border border-zinc-200 px-3 text-sm text-red-600 transition-colors hover:border-red-200 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-3 border-t border-zinc-100 pt-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Caption</label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption shown to participants during evaluation"
              className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Audio (auto-plays during evaluation)</label>

            {/* Existing saved audio */}
            {hasExistingAudio && !hasNewRecording && (
              <div className="mb-2 flex items-center gap-2">
                <button
                  onClick={() =>
                    handleReview(`/api/uploads?file=${encodeURIComponent(img.audioFilename!)}`)
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                  {playing ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><rect x="5" y="4" width="3" height="12" rx="1" /><rect x="12" y="4" width="3" height="12" rx="1" /></svg>
                      Stop
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.841Z" /></svg>
                      Review
                    </>
                  )}
                </button>
                <button
                  onClick={() => setRemoveAudio(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors hover:border-red-200 hover:bg-red-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022 1.005 11.36A2.75 2.75 0 0 0 7.76 20h4.48a2.75 2.75 0 0 0 2.742-2.489l1.005-11.36.149.022a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" /></svg>
                  Delete
                </button>
              </div>
            )}

            {/* Audio removed notice */}
            {removeAudio && !hasNewRecording && (
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs text-red-500">Audio will be removed on save</span>
                <button
                  onClick={() => setRemoveAudio(false)}
                  className="text-xs text-zinc-500 hover:text-zinc-700"
                >
                  Undo
                </button>
              </div>
            )}

            {/* New recording preview */}
            {hasNewRecording && (
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                  New recording ready
                </span>
                <button
                  onClick={() => handleReview(URL.createObjectURL(audioBlob!))}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-50"
                >
                  {playing ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><rect x="5" y="4" width="3" height="12" rx="1" /><rect x="12" y="4" width="3" height="12" rx="1" /></svg>
                      Stop
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.841Z" /></svg>
                      Review
                    </>
                  )}
                </button>
                <button
                  onClick={handleDeleteRecording}
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors hover:border-red-200 hover:bg-red-50"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022 1.005 11.36A2.75 2.75 0 0 0 7.76 20h4.48a2.75 2.75 0 0 0 2.742-2.489l1.005-11.36.149.022a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" /></svg>
                  Redo
                </button>
              </div>
            )}

            {/* Record button */}
            {!hasNewRecording && (
              <button
                onClick={isRecording ? () => stopRecording() : startRecording}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isRecording
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {isRecording ? (
                  <>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 1 1-6 0V4Z" /><path d="M5.5 9.643a.75.75 0 0 0-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.546A6.001 6.001 0 0 0 16 10v-.357a.75.75 0 0 0-1.5 0V10a4.5 4.5 0 0 1-9 0v-.357Z" /></svg>
                    Record
                  </>
                )}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving || isRecording}
              className="flex h-9 items-center rounded-lg bg-zinc-800 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={handleCancel}
              disabled={isRecording}
              className="flex h-9 items-center rounded-lg border border-zinc-200 px-4 text-sm text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EditSurveyPage() {
  const { id } = useParams<{ id: string }>();

  const [session, setSession] = useState<Survey | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Form fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [introHeading, setIntroHeading] = useState("");
  const [introBody, setIntroBody] = useState("");
  const [outroHeading, setOutroHeading] = useState("");
  const [outroBody, setOutroBody] = useState("");
  const [votingMode, setVotingMode] = useState<"binary" | "scale" | "pairwise" | "guided_tour">("binary");
  const [language, setLanguage] = useState<Locale>("en");
  const [randomizeOrder, setRandomizeOrder] = useState(false);
  const [autoRecord, setAutoRecord] = useState(false);

  // Image upload fields
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [imageLabel, setImageLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [copied, setCopied] = useState(false);

  const fetchSession = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/surveys/${id}`);
      if (res.ok) {
        const data: Survey = await res.json();
        setSession(data);
        setTitle(data.title);
        setDescription(data.description || "");
        setIntroHeading(data.introHeading);
        setIntroBody(data.introBody);
        setOutroHeading(data.outroHeading);
        setOutroBody(data.outroBody);
        setVotingMode(data.votingMode);
        setLanguage((data.language || "en") as Locale);
        setRandomizeOrder(data.randomizeOrder);
        setAutoRecord(data.autoRecord ?? false);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMessage("");
    try {
      const res = await fetch(`/api/surveys/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          introHeading,
          introBody,
          outroHeading,
          outroBody,
          votingMode,
          language,
          randomizeOrder,
          autoRecord,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSession(data);
        setSaveMessage("Saved successfully");
        setTimeout(() => setSaveMessage(""), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadImage() {
    if (!imageFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      if (videoFile) formData.append("video", videoFile);
      if (audioFile) formData.append("audio", audioFile);
      if (imageLabel.trim()) formData.append("label", imageLabel.trim());
      const nextOrder = session?.images.length ?? 0;
      formData.append("sortOrder", String(nextOrder));

      const res = await fetch(`/api/surveys/${id}/images`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setImageFile(null);
        setVideoFile(null);
        setAudioFile(null);
        setImageLabel("");
        // Reset the file inputs
        const imageInput = document.getElementById("imageUpload") as HTMLInputElement;
        const videoInput = document.getElementById("videoUpload") as HTMLInputElement;
        const audioInput = document.getElementById("audioUpload") as HTMLInputElement;
        if (imageInput) imageInput.value = "";
        if (videoInput) videoInput.value = "";
        if (audioInput) audioInput.value = "";
        await fetchSession();
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleMediaUpload(target: "intro" | "outro", file: File) {
    const formData = new FormData();
    formData.append("target", target);
    formData.append("file", file);
    const res = await fetch(`/api/surveys/${id}/media`, {
      method: "POST",
      body: formData,
    });
    if (res.ok) {
      await fetchSession();
    }
  }

  async function handleMediaDelete(target: "intro" | "outro") {
    const res = await fetch(`/api/surveys/${id}/media`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target }),
    });
    if (res.ok) {
      await fetchSession();
    }
  }

  async function handleBulkUpload(files: FileList) {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    setBulkUploading(true);
    setBulkProgress({ done: 0, total: imageFiles.length });

    let currentOrder = session?.images.length ?? 0;
    for (const file of imageFiles) {
      const formData = new FormData();
      formData.append("image", file);
      // Use filename without extension as label
      const label = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
      formData.append("label", label);
      formData.append("sortOrder", String(currentOrder));

      await fetch(`/api/surveys/${id}/images`, {
        method: "POST",
        body: formData,
      });

      currentOrder++;
      setBulkProgress((prev) => ({ ...prev, done: prev.done + 1 }));
    }

    // Reset
    const bulkInput = document.getElementById("bulkUpload") as HTMLInputElement;
    if (bulkInput) bulkInput.value = "";
    setBulkUploading(false);
    setBulkProgress({ done: 0, total: 0 });
    await fetchSession();
  }

  async function handleDeleteImage(imageId: string) {
    if (!confirm("Delete this image?")) return;
    const res = await fetch(`/api/surveys/${id}/images`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId }),
    });
    if (res.ok) {
      await fetchSession();
    }
  }

  async function handleUpdateImage(imageId: string, caption: string, audio: File | null, removeAudio: boolean) {
    const formData = new FormData();
    formData.append("imageId", imageId);
    formData.append("caption", caption);
    if (audio) formData.append("audio", audio);
    if (removeAudio) formData.append("removeAudio", "true");

    const res = await fetch(`/api/surveys/${id}/images`, {
      method: "PATCH",
      body: formData,
    });
    if (res.ok) {
      await fetchSession();
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="text-center">
          <p className="text-zinc-500">Survey not found.</p>
          <Link
            href="/admin/projects"
            className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  const sessionUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/s/${session.code}`;

  const inputClass =
    "w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
  const labelClass = "block text-sm font-medium text-zinc-700 mb-1.5";

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-12">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href={`/admin/surveys/${id}`}
              className="text-sm text-zinc-500 hover:text-zinc-700"
            >
              &larr; Back to survey
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-zinc-900">
              Edit Survey
            </h1>
          </div>
        </div>

        {/* Share Section */}
        <div className="mb-8 rounded-xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="text-sm font-semibold text-blue-900">
            Share this survey
          </h2>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <input
              readOnly
              value={sessionUrl}
              className="h-10 flex-1 rounded-lg border border-blue-200 bg-white px-3 text-sm text-zinc-700 focus:outline-none"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(sessionUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="h-10 min-w-[5rem] rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-sm text-blue-700">
            Survey code: <span className="font-mono font-bold">{session.code}</span>
          </p>
        </div>

        {/* Session Settings Form */}
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <label htmlFor="title" className={labelClass}>
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={inputClass}
            />
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-zinc-900">
              Intro Screen
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="introHeading" className={labelClass}>
                  Heading
                </label>
                <input
                  id="introHeading"
                  type="text"
                  value={introHeading}
                  onChange={(e) => setIntroHeading(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="introBody" className={labelClass}>
                  Body
                </label>
                <textarea
                  id="introBody"
                  value={introBody}
                  onChange={(e) => setIntroBody(e.target.value)}
                  rows={3}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Background image or video</label>
                {session.introMediaFilename ? (
                  <div className="flex items-center gap-3">
                    {session.introMediaFilename.match(/\.(mp4|webm|mov)$/i) ? (
                      <video
                        src={`/api/uploads?file=${encodeURIComponent(session.introMediaFilename)}`}
                        className="h-20 w-32 rounded-lg border border-zinc-200 object-cover"
                        muted
                      />
                    ) : (
                      <img
                        src={`/api/uploads?file=${encodeURIComponent(session.introMediaFilename)}`}
                        alt="Intro media"
                        className="h-20 w-32 rounded-lg border border-zinc-200 object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleMediaDelete("intro")}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleMediaUpload("intro", f);
                    }}
                    className="w-full text-sm text-zinc-600 file:mr-3 file:h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-zinc-100 file:px-4 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-zinc-900">
              Outro Screen
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="outroHeading" className={labelClass}>
                  Heading
                </label>
                <input
                  id="outroHeading"
                  type="text"
                  value={outroHeading}
                  onChange={(e) => setOutroHeading(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="outroBody" className={labelClass}>
                  Body
                </label>
                <textarea
                  id="outroBody"
                  value={outroBody}
                  onChange={(e) => setOutroBody(e.target.value)}
                  rows={3}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Background image or video</label>
                {session.outroMediaFilename ? (
                  <div className="flex items-center gap-3">
                    {session.outroMediaFilename.match(/\.(mp4|webm|mov)$/i) ? (
                      <video
                        src={`/api/uploads?file=${encodeURIComponent(session.outroMediaFilename)}`}
                        className="h-20 w-32 rounded-lg border border-zinc-200 object-cover"
                        muted
                      />
                    ) : (
                      <img
                        src={`/api/uploads?file=${encodeURIComponent(session.outroMediaFilename)}`}
                        alt="Outro media"
                        className="h-20 w-32 rounded-lg border border-zinc-200 object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleMediaDelete("outro")}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleMediaUpload("outro", f);
                    }}
                    className="w-full text-sm text-zinc-600 file:mr-3 file:h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-zinc-100 file:px-4 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-6">
            <h2 className="mb-4 text-base font-semibold text-zinc-900">
              Voting Settings
            </h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="votingMode" className={labelClass}>
                  Voting Mode
                </label>
                <select
                  id="votingMode"
                  value={votingMode}
                  onChange={(e) =>
                    setVotingMode(e.target.value as "binary" | "scale" | "pairwise" | "guided_tour")
                  }
                  className={inputClass}
                >
                  <option value="binary">Binary (Yes / No)</option>
                  <option value="scale">Scale (1-5)</option>
                  <option value="pairwise">Pairwise Comparison</option>
                  <option value="guided_tour">Guided Tour (Rate + Compare)</option>
                </select>
                {votingMode === "guided_tour" && (
                  <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                    <p>Phase 1: Rate each image. Phase 2: Compare all pairs side by side.</p>
                    {session && session.images.length > 0 && (
                      <p className="mt-1 font-medium">
                        {session.images.length} images = {(session.images.length * (session.images.length - 1)) / 2} pairs
                        {session.images.length > 10 && (
                          <span className="ml-1 text-amber-700"> (this may be long for participants)</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="randomizeOrder"
                  type="checkbox"
                  checked={randomizeOrder}
                  onChange={(e) => setRandomizeOrder(e.target.checked)}
                  className="h-5 w-5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="randomizeOrder" className="text-sm text-zinc-700">
                  Randomize image order for each participant
                </label>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="autoRecord"
                  type="checkbox"
                  checked={autoRecord}
                  onChange={(e) => setAutoRecord(e.target.checked)}
                  className="h-5 w-5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="autoRecord" className="text-sm text-zinc-700">
                  Auto-record participant audio for each image
                </label>
              </div>
              <div>
                <label htmlFor="language" className={labelClass}>
                  Participant Language
                </label>
                <select
                  id="language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as Locale)}
                  className={inputClass}
                >
                  {LOCALES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-sm text-zinc-400">
                  UI text shown to participants will be in this language. Intro/outro text above is shown as-is.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving || !title.trim()}
              className="flex h-12 flex-1 items-center justify-center rounded-lg bg-blue-600 text-base font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
            {saveMessage && (
              <span className="text-sm font-medium text-green-600">
                {saveMessage}
              </span>
            )}
          </div>
        </form>

        {/* Image Management */}
        <div className="mt-12">
          <h2 className="text-xl font-bold text-zinc-900">Images</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {session.images.length} image{session.images.length !== 1 ? "s" : ""} in this survey
          </p>

          {/* Bulk Upload Area */}
          <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-white p-6">
            <h3 className="mb-1 text-sm font-semibold text-zinc-700">
              Add Images
            </h3>
            <p className="mb-4 text-sm text-zinc-500">
              Select multiple files or an entire folder. Labels are set from filenames.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex h-11 cursor-pointer items-center rounded-lg bg-zinc-800 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700">
                Choose Files
                <input
                  id="bulkUpload"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleBulkUpload(e.target.files);
                    }
                  }}
                  disabled={bulkUploading}
                />
              </label>
              <label className="flex h-11 cursor-pointer items-center rounded-lg border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50">
                Choose Folder
                <input
                  type="file"
                  accept="image/*"
                  /* @ts-expect-error webkitdirectory is not in TS types */
                  webkitdirectory=""
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleBulkUpload(e.target.files);
                    }
                  }}
                  disabled={bulkUploading}
                />
              </label>
              {bulkUploading && (
                <span className="text-sm text-zinc-500">
                  Uploading {bulkProgress.done}/{bulkProgress.total}...
                </span>
              )}
            </div>
          </div>

          {/* Single Image + Video Upload */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-zinc-500 hover:text-zinc-700">
              Add single image with video/audio
            </summary>
            <div className="mt-3 rounded-xl border border-dashed border-zinc-300 bg-white p-6 space-y-4">
              <div>
                <label htmlFor="imageUpload" className={labelClass}>
                  Image file <span className="text-red-500">*</span>
                </label>
                <input
                  id="imageUpload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-zinc-600 file:mr-3 file:h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-zinc-100 file:px-4 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
                />
              </div>
              <div>
                <label htmlFor="videoUpload" className={labelClass}>
                  Video file (optional)
                </label>
                <input
                  id="videoUpload"
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-zinc-600 file:mr-3 file:h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-zinc-100 file:px-4 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
                />
              </div>
              <div>
                <label htmlFor="audioUpload" className={labelClass}>
                  Audio file (optional — auto-plays during evaluation)
                </label>
                <input
                  id="audioUpload"
                  type="file"
                  accept="audio/*"
                  onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-zinc-600 file:mr-3 file:h-10 file:cursor-pointer file:rounded-lg file:border-0 file:bg-zinc-100 file:px-4 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200"
                />
              </div>
              <div>
                <label htmlFor="imageLabel" className={labelClass}>
                  Label (optional)
                </label>
                <input
                  id="imageLabel"
                  type="text"
                  value={imageLabel}
                  onChange={(e) => setImageLabel(e.target.value)}
                  placeholder="e.g. Design A"
                  className={inputClass}
                />
              </div>
              <button
                type="button"
                onClick={handleUploadImage}
                disabled={!imageFile || uploading}
                className="flex h-11 items-center rounded-lg bg-zinc-800 px-6 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Add Image"}
              </button>
            </div>
          </details>

          {/* Image List */}
          {session.images.length > 0 && (
            <div className="mt-6 space-y-3">
              {session.images.map((img, index) => (
                <ImageRow
                  key={img.id}
                  img={img}
                  index={index}
                  onDelete={handleDeleteImage}
                  onUpdate={handleUpdateImage}
                />
              ))}
            </div>
          )}

          {/* Share Section (bottom) */}
          <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50 p-5">
            <h2 className="text-sm font-semibold text-blue-900">
              Share this survey
            </h2>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <input
                readOnly
                value={sessionUrl}
                className="h-10 flex-1 rounded-lg border border-blue-200 bg-white px-3 text-sm text-zinc-700 focus:outline-none"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(sessionUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="h-10 min-w-[5rem] rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-sm text-blue-700">
              Survey code: <span className="font-mono font-bold">{session.code}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
