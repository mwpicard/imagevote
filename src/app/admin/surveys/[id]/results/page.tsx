"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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

interface Survey {
  id: string;
  title: string;
  code: string;
  votingMode: string;
  projectId: string | null;
  images: ImageData[];
}

interface ResponseData {
  id: string;
  imageId: string;
  participantId: string;
  vote: number | null;
  audioFilename: string | null;
  transcription: string | null;
  createdAt: string;
  image: ImageData;
}

interface PairwiseResponseData {
  id: string;
  surveyId: string;
  participantId: string;
  imageAId: string;
  imageBId: string;
  winnerId: string | null;
  score: number | null;
  audioFilename: string | null;
  transcription: string | null;
  createdAt: string;
}

interface OutroRecording {
  id: string;
  participantId: string;
  audioFilename: string;
  transcription: string | null;
  createdAt: string;
}

interface Participant {
  id: string;
  firstName: string;
  lastName: string | null;
  age: number | null;
  createdAt: string;
}

interface TranscribeStatus {
  available: boolean;
  pending: { responses: number; pairwise: number; outro: number; total: number };
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"];

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [responses, setResponses] = useState<ResponseData[]>([]);
  const [pairwiseResponses, setPairwiseResponses] = useState<PairwiseResponseData[]>([]);
  const [outroRecordings, setOutroRecordings] = useState<OutroRecording[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [transcribeStatus, setTranscribeStatus] = useState<TranscribeStatus | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(() => {
    fetch(`/api/surveys/${id}`).then((r) => r.json()).then(setSurvey);
    fetch(`/api/surveys/${id}/responses`).then((r) => r.json()).then(setResponses);
    fetch(`/api/surveys/${id}/pairwise-responses`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setPairwiseResponses(Array.isArray(data) ? data : []));
    fetch(`/api/surveys/${id}/outro-recording`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setOutroRecordings(Array.isArray(data) ? data : []));
    fetch(`/api/surveys/${id}/participants`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setParticipants(Array.isArray(data) ? data : []));
    fetch(`/api/surveys/${id}/transcribe`)
      .then((r) => r.ok ? r.json() : null)
      .then(setTranscribeStatus);
  }, [id]);

  // Initial fetch + polling with visibility API
  useEffect(() => {
    fetchData();

    function startPolling() {
      stopPolling();
      intervalRef.current = setInterval(fetchData, 10_000);
    }

    function stopPolling() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    function handleVisibility() {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchData();
        startPolling();
      }
    }

    startPolling();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchData]);

  async function handleTranscribe() {
    setTranscribing(true);
    try {
      await fetch(`/api/surveys/${id}/transcribe`, { method: "POST" });
      fetchData();
    } finally {
      setTranscribing(false);
    }
  }

  if (!survey) {
    return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>;
  }

  const isGuidedTour = survey.votingMode === "guided_tour";
  const participantIds = [...new Set(responses.map((r) => r.participantId))];
  const participantMap = new Map(participants.map((p) => [p.id, p]));

  function participantName(pid: string) {
    const p = participantMap.get(pid);
    if (!p) return pid.slice(0, 8);
    let name = p.lastName
      ? `${p.firstName} ${p.lastName.charAt(0)}.`
      : p.firstName;
    if (p.age) name += ` (${p.age})`;
    return name;
  }

  const sessionUrl = typeof window !== "undefined"
    ? `${window.location.origin}/s/${survey.code}`
    : `/s/${survey.code}`;

  // Build per-image stats
  const imageStats = survey.images.map((img, idx) => {
    const imgResponses = responses.filter((r) => r.imageId === img.id);
    const votes = imgResponses.filter((r) => r.vote !== null).map((r) => r.vote!);
    const audioCount = imgResponses.filter((r) => r.audioFilename).length;

    let voteLabel = "";
    let voteValue = 0;

    if (survey.votingMode === "binary" || isGuidedTour) {
      const up = votes.filter((v) => v === 1).length;
      const down = votes.filter((v) => v === 0).length;
      voteLabel = `\u{1F44D} ${up} / \u{1F44E} ${down}`;
      voteValue = up;
    } else if (survey.votingMode === "scale") {
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

  // Pairwise ranking data (win percentage per image)
  const imageNameMap = new Map(survey.images.map((img, idx) => [img.id, img.label || `Image ${idx + 1}`]));

  const imageFilenameMap = new Map(survey.images.map((img) => [img.id, img.filename]));

  const rankingData = survey.images.map((img, idx) => {
    const wins = pairwiseResponses.filter((r) => r.winnerId === img.id).length;
    const total = pairwiseResponses.filter(
      (r) => r.imageAId === img.id || r.imageBId === img.id
    ).length;
    return {
      name: img.label || `Image ${idx + 1}`,
      id: img.id,
      filename: img.filename,
      wins,
      total,
    };
  }).sort((a, b) => b.wins - a.wins);

  const pairwiseWinner = rankingData.length > 0 && rankingData[0].wins > 0 ? rankingData[0] : null;
  const isTie = pairwiseWinner && rankingData.length > 1 && rankingData[1].wins === pairwiseWinner.wins;

  // Head-to-head matrix
  function getH2HRecord(imgA: string, imgB: string) {
    const relevant = pairwiseResponses.filter(
      (r) =>
        (r.imageAId === imgA && r.imageBId === imgB) ||
        (r.imageAId === imgB && r.imageBId === imgA)
    );
    const winsA = relevant.filter((r) => r.winnerId === imgA).length;
    const winsB = relevant.filter((r) => r.winnerId === imgB).length;
    return { winsA, winsB, total: relevant.length };
  }

  function playAudio(filename: string) {
    const audio = new Audio(`/api/uploads?file=${filename}`);
    setPlayingAudio(filename);
    audio.onended = () => setPlayingAudio(null);
    audio.play();
  }

  function exportData(format: "csv" | "json") {
    const data = responses.map((r) => {
      const p = participantMap.get(r.participantId);
      return {
        imageId: r.imageId,
        imageLabel: survey!.images.find((i) => i.id === r.imageId)?.label || "",
        participantId: r.participantId,
        participantFirstName: p?.firstName || "",
        participantLastName: p?.lastName || "",
        participantAge: p?.age ?? "",
        vote: r.vote,
        audioFilename: r.audioFilename || "",
        transcription: r.transcription || "",
        createdAt: r.createdAt,
      };
    });

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
    a.download = `${survey!.title}-results.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPairwiseData(format: "csv" | "json") {
    const data = pairwiseResponses.map((r) => {
      const p = participantMap.get(r.participantId);
      return {
      participantId: r.participantId,
      participantFirstName: p?.firstName || "",
      participantLastName: p?.lastName || "",
      participantAge: p?.age ?? "",
      imageAId: r.imageAId,
      imageALabel: imageNameMap.get(r.imageAId) || "",
      imageBId: r.imageBId,
      imageBLabel: imageNameMap.get(r.imageBId) || "",
      winnerId: r.winnerId || "",
      winnerLabel: r.winnerId ? (imageNameMap.get(r.winnerId) || "") : "",
      score: r.score ?? "",
      audioFilename: r.audioFilename || "",
      transcription: r.transcription || "",
      createdAt: r.createdAt,
    };
    });

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
    a.download = `${survey!.title}-pairwise.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pendingCount = transcribeStatus?.pending.total ?? 0;
  const showTranscribeButton = transcribeStatus?.available && pendingCount > 0;

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 max-w-6xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <Link href={`/admin/surveys/${id}`} className="text-blue-600 text-sm hover:underline">
            &larr; Back to survey
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{survey.title} — Dashboard</h1>
            <span className="relative flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              Live
            </span>
          </div>
          <p className="text-gray-500 mt-1">
            {participantIds.length} participant{participantIds.length !== 1 ? "s" : ""}
            {participants.length > 0 && (
              <span> ({participants.map((p) => p.firstName).join(", ")})</span>
            )}
            {" "}&middot;{" "}
            {responses.length} response{responses.length !== 1 ? "s" : ""}
            {isGuidedTour && (
              <> &middot; {pairwiseResponses.length} pairwise comparison{pairwiseResponses.length !== 1 ? "s" : ""}</>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {showTranscribeButton && (
            <button
              onClick={handleTranscribe}
              disabled={transcribing}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {transcribing ? "Transcribing..." : `Transcribe (${pendingCount})`}
            </button>
          )}
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
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
        <QRCodeSVG value={sessionUrl} size={120} />
        <div className="text-center sm:text-left">
          <p className="text-sm text-gray-500 mb-1">Share this survey</p>
          <p className="font-mono text-sm sm:text-lg text-gray-900 bg-gray-100 px-3 py-1.5 rounded break-all">{sessionUrl}</p>
          <p className="text-sm text-gray-500 mt-2">Code: <span className="font-mono font-bold">{survey.code}</span></p>
        </div>
      </div>

      {/* Phase 1 header for guided tour */}
      {isGuidedTour && responses.length > 0 && (
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Phase 1 — Individual Ratings</h2>
      )}

      {/* Chart */}
      {chartData.length > 0 && responses.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {survey.votingMode === "binary" || isGuidedTour
              ? "Positive Votes"
              : survey.votingMode === "scale"
                ? "Average Rating"
                : "Preference Count"}
          </h2>
          <div className="h-[200px] sm:h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
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
        </div>
      )}

      {/* Per-image breakdown */}
      <div className="space-y-6">
        {imageStats.map((stat) => (
          <div key={stat.id} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
              <img
                src={`/api/uploads?file=${stat.filename}`}
                alt={stat.name}
                className="w-full sm:w-32 h-48 sm:h-32 object-cover rounded-lg flex-shrink-0"
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
                  <div className="mt-4 space-y-2">
                    {stat.responses
                      .filter((r) => r.audioFilename)
                      .map((r) => (
                        <div key={r.id} className="flex items-start gap-2">
                          <button
                            onClick={() => playAudio(r.audioFilename!)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 ${
                              playingAudio === r.audioFilename
                                ? "bg-blue-100 text-blue-700"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            {playingAudio === r.audioFilename ? "Playing..." : `\u25B6 ${participantName(r.participantId)}`}
                          </button>
                          {r.transcription && (
                            <p className="text-sm italic text-gray-500">&ldquo;{r.transcription}&rdquo;</p>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Phase 2: Pairwise Comparison Results (guided_tour only) */}
      {isGuidedTour && pairwiseResponses.length > 0 && (
        <>
          <h2 className="text-2xl font-bold text-gray-900 mt-12 mb-4">Phase 2 — Pairwise Comparisons</h2>

          {/* Winner banner */}
          {pairwiseWinner && (
            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-6 mb-8 flex items-center gap-5">
              <img
                src={`/api/uploads?file=${survey.images.find((i) => i.id === pairwiseWinner.id)?.filename}`}
                alt={pairwiseWinner.name}
                className="w-20 h-20 object-cover rounded-lg border-2 border-amber-300 flex-shrink-0"
              />
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-amber-600">
                  {isTie ? "Tied for First" : "Winner"}
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">
                  {isTie
                    ? rankingData.filter((r) => r.wins === pairwiseWinner.wins).map((r) => r.name).join(" & ")
                    : pairwiseWinner.name}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {pairwiseWinner.wins} point{pairwiseWinner.wins !== 1 ? "s" : ""} ({pairwiseWinner.wins}/{pairwiseWinner.total} matchups won)
                </p>
              </div>
            </div>
          )}

          {/* Export buttons for pairwise data */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => exportPairwiseData("csv")}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              Export Pairwise CSV
            </button>
            <button
              onClick={() => exportPairwiseData("json")}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              Export Pairwise JSON
            </button>
          </div>

          {/* Overall ranking chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Points (Victories)</h3>
            <div className="h-[240px] sm:h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rankingData} margin={{ bottom: 50 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="name"
                  tick={(props) => {
                    const { x, y, payload } = props as { x: number; y: number; payload: { value: string } };
                    const item = rankingData.find((r) => r.name === payload.value);
                    if (!item) return <text />;
                    return (
                      <g transform={`translate(${x},${y + 8})`}>
                        <clipPath id={`clip-rank-${item.id}`}>
                          <circle cx={0} cy={16} r={16} />
                        </clipPath>
                        <image
                          href={`/api/uploads?file=${encodeURIComponent(item.filename)}`}
                          x={-16}
                          y={0}
                          width={32}
                          height={32}
                          clipPath={`url(#clip-rank-${item.id})`}
                          preserveAspectRatio="xMidYMid slice"
                        />
                      </g>
                    );
                  }}
                  interval={0}
                  height={50}
                />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(value) => [`${value} pts`, "Wins"]} />
                <Bar dataKey="wins" radius={[6, 6, 0, 0]}>
                  {rankingData.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>

          {/* Head-to-head matrix */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 overflow-x-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Head-to-Head Matrix</h3>
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr>
                  <th className="p-2"></th>
                  {survey.images.map((img, idx) => (
                    <th key={img.id} className="p-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <img
                          src={`/api/uploads?file=${encodeURIComponent(img.filename)}`}
                          alt={img.label || `Image ${idx + 1}`}
                          className="h-10 w-10 rounded-md object-cover"
                        />
                      </div>
                    </th>
                  ))}
                  <th className="p-2 text-center font-semibold text-gray-900 text-sm">Pts</th>
                </tr>
              </thead>
              <tbody>
                {survey.images.map((rowImg, rowIdx) => (
                  <tr key={rowImg.id} className="border-t border-gray-100">
                    <td className="p-2">
                      <img
                        src={`/api/uploads?file=${encodeURIComponent(rowImg.filename)}`}
                        alt={rowImg.label || `Image ${rowIdx + 1}`}
                        className="h-10 w-10 rounded-md object-cover"
                      />
                    </td>
                    {survey.images.map((colImg) => {
                      if (rowImg.id === colImg.id) {
                        return (
                          <td key={colImg.id} className="p-2 text-center bg-gray-50 text-gray-300">
                            —
                          </td>
                        );
                      }
                      const record = getH2HRecord(rowImg.id, colImg.id);
                      let bgColor: string;
                      let winnerId: string | null;
                      if (record.total === 0) {
                        winnerId = null;
                        bgColor = "bg-gray-50";
                      } else if (record.winsA > record.winsB) {
                        winnerId = rowImg.id;
                        bgColor = "bg-green-50";
                      } else if (record.winsB > record.winsA) {
                        winnerId = colImg.id;
                        bgColor = "bg-red-50";
                      } else {
                        winnerId = null;
                        bgColor = "bg-yellow-50";
                      }
                      const winnerFilename = winnerId ? imageFilenameMap.get(winnerId) : null;
                      const pairAudios = pairwiseResponses.filter(
                        (r) =>
                          r.audioFilename &&
                          ((r.imageAId === rowImg.id && r.imageBId === colImg.id) ||
                            (r.imageAId === colImg.id && r.imageBId === rowImg.id))
                      );
                      return (
                        <td key={colImg.id} className={`p-2 text-center ${bgColor}`}>
                          <div className="flex flex-col items-center gap-1">
                            {winnerFilename ? (
                              <img
                                src={`/api/uploads?file=${encodeURIComponent(winnerFilename)}`}
                                alt="Winner"
                                className="mx-auto h-8 w-8 rounded object-cover"
                              />
                            ) : record.total === 0 ? (
                              <span className="text-gray-300">—</span>
                            ) : (
                              <span className="text-xs font-medium text-yellow-700">Tie</span>
                            )}
                            {pairAudios.length > 0 && (
                              <div className="flex gap-0.5">
                                {pairAudios.map((r) => (
                                  <button
                                    key={r.id}
                                    onClick={() => playAudio(r.audioFilename!)}
                                    className={`h-5 w-5 rounded-full flex items-center justify-center transition-colors ${
                                      playingAudio === r.audioFilename
                                        ? "bg-blue-500 text-white"
                                        : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                                    }`}
                                    title={r.transcription || "Play audio"}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3">
                                      <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4Z" />
                                      <path d="M6 11a1 1 0 1 0-2 0 8 8 0 0 0 7 7.93V21H8a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-3v-2.07A8 8 0 0 0 20 11a1 1 0 1 0-2 0 6 6 0 0 1-12 0Z" />
                                    </svg>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td className="p-2 text-center bg-gray-100 font-bold text-gray-900">
                      {rankingData.find((r) => r.id === rowImg.id)?.wins ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-gray-400">
              Each cell shows the winner of that matchup. Green = row image won, Red = column image won. Pts = total victories.
            </p>
          </div>

        </>
      )}

      {/* Outro recordings */}
      {outroRecordings.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Final Impressions</h2>
          <div className="space-y-2">
            {outroRecordings.map((rec) => (
              <div key={rec.id} className="flex items-start gap-2">
                <button
                  onClick={() => playAudio(rec.audioFilename)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium flex-shrink-0 ${
                    playingAudio === rec.audioFilename
                      ? "bg-blue-100 text-blue-700"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {playingAudio === rec.audioFilename ? "Playing..." : `\u25B6 ${participantName(rec.participantId)}`}
                </button>
                {rec.transcription && (
                  <p className="text-sm italic text-gray-500">&ldquo;{rec.transcription}&rdquo;</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {responses.length === 0 && pairwiseResponses.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No responses yet</p>
          <p className="text-sm mt-2">Share the survey link to start collecting feedback</p>
        </div>
      )}
    </div>
  );
}
