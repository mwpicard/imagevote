"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

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
  description: string | null;
  introHeading: string;
  introBody: string;
  outroHeading: string;
  outroBody: string;
  votingMode: "binary" | "scale" | "pairwise";
  randomizeOrder: boolean;
  code: string;
  createdAt: string;
  images: ImageItem[];
}

export default function EditSessionPage() {
  const { id } = useParams<{ id: string }>();

  const [session, setSession] = useState<Session | null>(null);
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
  const [votingMode, setVotingMode] = useState<"binary" | "scale" | "pairwise">("binary");
  const [randomizeOrder, setRandomizeOrder] = useState(false);

  // Image upload fields
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [imageLabel, setImageLabel] = useState("");
  const [uploading, setUploading] = useState(false);

  const fetchSession = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const data: Session = await res.json();
        setSession(data);
        setTitle(data.title);
        setDescription(data.description || "");
        setIntroHeading(data.introHeading);
        setIntroBody(data.introBody);
        setOutroHeading(data.outroHeading);
        setOutroBody(data.outroBody);
        setVotingMode(data.votingMode);
        setRandomizeOrder(data.randomizeOrder);
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
      const res = await fetch(`/api/sessions/${id}`, {
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
          randomizeOrder,
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
      if (imageLabel.trim()) formData.append("label", imageLabel.trim());
      const nextOrder = session?.images.length ?? 0;
      formData.append("sortOrder", String(nextOrder));

      const res = await fetch(`/api/sessions/${id}/images`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setImageFile(null);
        setVideoFile(null);
        setImageLabel("");
        // Reset the file inputs
        const imageInput = document.getElementById("imageUpload") as HTMLInputElement;
        const videoInput = document.getElementById("videoUpload") as HTMLInputElement;
        if (imageInput) imageInput.value = "";
        if (videoInput) videoInput.value = "";
        await fetchSession();
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteImage(imageId: string) {
    if (!confirm("Delete this image?")) return;
    const res = await fetch(`/api/sessions/${id}/images`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageId }),
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
          <p className="text-zinc-500">Session not found.</p>
          <Link
            href="/admin/sessions"
            className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Back to sessions
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
      <div className="mx-auto max-w-2xl px-6 py-12">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <Link
              href="/admin/sessions"
              className="text-sm text-zinc-500 hover:text-zinc-700"
            >
              &larr; Back to sessions
            </Link>
            <h1 className="mt-1 text-2xl font-bold text-zinc-900">
              Edit Session
            </h1>
          </div>
          <Link
            href={`/admin/sessions/${id}/results`}
            className="flex h-10 items-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            View Results
          </Link>
        </div>

        {/* Share Section */}
        <div className="mb-8 rounded-xl border border-blue-100 bg-blue-50 p-5">
          <h2 className="text-sm font-semibold text-blue-900">
            Share this session
          </h2>
          <div className="mt-2 flex items-center gap-3">
            <input
              readOnly
              value={sessionUrl}
              className="h-10 flex-1 rounded-lg border border-blue-200 bg-white px-3 text-sm text-zinc-700 focus:outline-none"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={() => navigator.clipboard.writeText(sessionUrl)}
              className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Copy
            </button>
          </div>
          <p className="mt-2 text-sm text-blue-700">
            Session code: <span className="font-mono font-bold">{session.code}</span>
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
                    setVotingMode(e.target.value as "binary" | "scale" | "pairwise")
                  }
                  className={inputClass}
                >
                  <option value="binary">Binary (Yes / No)</option>
                  <option value="scale">Scale (1-5)</option>
                  <option value="pairwise">Pairwise Comparison</option>
                </select>
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
            {session.images.length} image{session.images.length !== 1 ? "s" : ""} in this session
          </p>

          {/* Upload Area */}
          <div className="mt-6 rounded-xl border border-dashed border-zinc-300 bg-white p-6">
            <h3 className="mb-4 text-sm font-semibold text-zinc-700">
              Add New Image
            </h3>
            <div className="space-y-4">
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
          </div>

          {/* Image List */}
          {session.images.length > 0 && (
            <div className="mt-6 space-y-3">
              {session.images.map((img, index) => (
                <div
                  key={img.id}
                  className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4"
                >
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
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-500">
                      {img.videoFilename && (
                        <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                          Video
                        </span>
                      )}
                      <span>Order: {img.sortOrder}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteImage(img.id)}
                    className="flex h-9 flex-shrink-0 items-center rounded-lg border border-zinc-200 px-3 text-sm text-red-600 transition-colors hover:border-red-200 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
