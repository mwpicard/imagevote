"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ImageData {
  id: string;
  filename: string;
  videoFilename: string | null;
  label: string | null;
  sortOrder: number;
}

interface Session {
  id: string;
  title: string;
  code: string;
  votingMode: string;
  images: ImageData[];
}

interface ResponseData {
  id: string;
  imageId: string;
  participantId: string;
  vote: number | null;
  audioFilename: string | null;
  createdAt: string;
  image: ImageData;
}

interface OutroRecording {
  id: string;
  participantId: string;
  audioFilename: string;
  createdAt: string;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<Session | null>(null);
  const [responses, setResponses] = useState<ResponseData[]>([]);
  const [outroRecordings, setOutroRecordings] = useState<OutroRecording[]>([]);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sessions/${id}`).then((r) => r.json()).then(setSession);
    fetch(`/api/sessions/${id}/responses`).then((r) => r.json()).then(setResponses);
    fetch(`/api/sessions/${id}/outro-recording`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setOutroRecordings(Array.isArray(data) ? data : []));
  }, [id]);

  if (!session) {
    return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>;
  }

  const participantIds = [...new Set(responses.map((r) => r.participantId))];
  const sessionUrl = typeof window !== "undefined"
    ? `${window.location.origin}/s/${session.code}`
    : `/s/${session.code}`;

  // Build per-image stats
  const imageStats = session.images.map((img, idx) => {
    const imgResponses = responses.filter((r) => r.imageId === img.id);
    const votes = imgResponses.filter((r) => r.vote !== null).map((r) => r.vote!);
    const audioCount = imgResponses.filter((r) => r.audioFilename).length;

    let voteLabel = "";
    let voteValue = 0;

    if (session.votingMode === "binary") {
      const up = votes.filter((v) => v === 1).length;
      const down = votes.filter((v) => v === 0).length;
      voteLabel = `👍 ${up} / 👎 ${down}`;
      voteValue = up;
    } else if (session.votingMode === "scale") {
      const avg = votes.length > 0 ? votes.reduce((a, b) => a + b, 0) / votes.length : 0;
      voteLabel = `Avg: ${avg.toFixed(1)} / 5`;
      voteValue = avg;
    } else {
      voteValue = votes.filter((v) => v === 1).length;
      voteLabel = `Preferred: ${voteValue}`;
    }

    return {
      id: img.id,
      name: img.label || `Image ${idx + 1}`,
      filename: img.filename,
      responses: imgResponses,
      totalVotes: votes.length,
      voteLabel,
      voteValue,
      audioCount,
    };
  });

  // Chart data
  const chartData = imageStats.map((s) => ({
    name: s.name,
    value: s.voteValue,
  }));

  function playAudio(filename: string) {
    const audio = new Audio(`/api/uploads?file=${filename}`);
    setPlayingAudio(filename);
    audio.onended = () => setPlayingAudio(null);
    audio.play();
  }

  function exportData(format: "csv" | "json") {
    const data = responses.map((r) => ({
      imageId: r.imageId,
      imageLabel: session!.images.find((i) => i.id === r.imageId)?.label || "",
      participantId: r.participantId,
      vote: r.vote,
      audioFilename: r.audioFilename || "",
      createdAt: r.createdAt,
    }));

    let content: string;
    let mime: string;
    let ext: string;

    if (format === "json") {
      content = JSON.stringify(data, null, 2);
      mime = "application/json";
      ext = "json";
    } else {
      const headers = Object.keys(data[0] || {}).join(",");
      const rows = data.map((d) => Object.values(d).join(",")).join("\n");
      content = `${headers}\n${rows}`;
      mime = "text/csv";
      ext = "csv";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session!.title}-results.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href={`/admin/sessions/${id}`} className="text-blue-600 text-sm hover:underline">
            &larr; Back to session
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-1">{session.title} — Results</h1>
          <p className="text-gray-500 mt-1">
            {participantIds.length} participant{participantIds.length !== 1 ? "s" : ""} &middot;{" "}
            {responses.length} response{responses.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => exportData("csv")}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            Export CSV
          </button>
          <button
            onClick={() => exportData("json")}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
          >
            Export JSON
          </button>
        </div>
      </div>

      {/* Share section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 flex items-center gap-6">
        <QRCodeSVG value={sessionUrl} size={120} />
        <div>
          <p className="text-sm text-gray-500 mb-1">Share this session</p>
          <p className="font-mono text-lg text-gray-900 bg-gray-100 px-3 py-1.5 rounded">{sessionUrl}</p>
          <p className="text-sm text-gray-500 mt-2">Code: <span className="font-mono font-bold">{session.code}</span></p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && responses.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {session.votingMode === "binary" ? "Positive Votes" : session.votingMode === "scale" ? "Average Rating" : "Preference Count"}
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Per-image breakdown */}
      <div className="space-y-6">
        {imageStats.map((stat, idx) => (
          <div key={stat.id} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex gap-6">
              <img
                src={`/api/uploads?file=${stat.filename}`}
                alt={stat.name}
                className="w-32 h-32 object-cover rounded-lg flex-shrink-0"
              />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">{stat.name}</h3>
                <div className="flex gap-6 mt-2 text-sm text-gray-600">
                  <span>{stat.totalVotes} vote{stat.totalVotes !== 1 ? "s" : ""}</span>
                  <span>{stat.voteLabel}</span>
                  <span>{stat.audioCount} recording{stat.audioCount !== 1 ? "s" : ""}</span>
                </div>

                {/* Audio recordings for this image */}
                {stat.responses.filter((r) => r.audioFilename).length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {stat.responses
                      .filter((r) => r.audioFilename)
                      .map((r) => (
                        <button
                          key={r.id}
                          onClick={() => playAudio(r.audioFilename!)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                            playingAudio === r.audioFilename
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {playingAudio === r.audioFilename ? "Playing..." : `▶ Recording`}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Outro recordings */}
      {outroRecordings.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Final Impressions</h2>
          <div className="flex flex-wrap gap-2">
            {outroRecordings.map((rec) => (
              <button
                key={rec.id}
                onClick={() => playAudio(rec.audioFilename)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  playingAudio === rec.audioFilename
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {playingAudio === rec.audioFilename ? "Playing..." : `▶ Participant`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {responses.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No responses yet</p>
          <p className="text-sm mt-2">Share the session link to start collecting feedback</p>
        </div>
      )}
    </div>
  );
}
