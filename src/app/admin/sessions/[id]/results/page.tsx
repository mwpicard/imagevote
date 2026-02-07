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

interface PairwiseResponseData {
  id: string;
  sessionId: string;
  participantId: string;
  imageAId: string;
  imageBId: string;
  winnerId: string;
  audioFilename: string | null;
  createdAt: string;
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
  const [pairwiseResponses, setPairwiseResponses] = useState<PairwiseResponseData[]>([]);
  const [outroRecordings, setOutroRecordings] = useState<OutroRecording[]>([]);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sessions/${id}`).then((r) => r.json()).then(setSession);
    fetch(`/api/sessions/${id}/responses`).then((r) => r.json()).then(setResponses);
    fetch(`/api/sessions/${id}/pairwise-responses`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setPairwiseResponses(Array.isArray(data) ? data : []));
    fetch(`/api/sessions/${id}/outro-recording`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setOutroRecordings(Array.isArray(data) ? data : []));
  }, [id]);

  if (!session) {
    return <div className="flex items-center justify-center min-h-screen text-gray-500">Loading...</div>;
  }

  const isGuidedTour = session.votingMode === "guided_tour";
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

    if (session.votingMode === "binary" || isGuidedTour) {
      const up = votes.filter((v) => v === 1).length;
      const down = votes.filter((v) => v === 0).length;
      voteLabel = `\u{1F44D} ${up} / \u{1F44E} ${down}`;
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

  // Pairwise ranking data (win percentage per image)
  const imageNameMap = new Map(session.images.map((img, idx) => [img.id, img.label || `Image ${idx + 1}`]));

  const imageFilenameMap = new Map(session.images.map((img) => [img.id, img.filename]));

  const rankingData = session.images.map((img, idx) => {
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

  function exportPairwiseData(format: "csv" | "json") {
    const data = pairwiseResponses.map((r) => ({
      participantId: r.participantId,
      imageAId: r.imageAId,
      imageALabel: imageNameMap.get(r.imageAId) || "",
      imageBId: r.imageBId,
      imageBLabel: imageNameMap.get(r.imageBId) || "",
      winnerId: r.winnerId,
      winnerLabel: imageNameMap.get(r.winnerId) || "",
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
    a.download = `${session!.title}-pairwise.${ext}`;
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
            {isGuidedTour && (
              <> &middot; {pairwiseResponses.length} pairwise comparison{pairwiseResponses.length !== 1 ? "s" : ""}</>
            )}
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

      {/* Phase 1 header for guided tour */}
      {isGuidedTour && responses.length > 0 && (
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Phase 1 — Individual Ratings</h2>
      )}

      {/* Chart */}
      {chartData.length > 0 && responses.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {session.votingMode === "binary" || isGuidedTour
              ? "Positive Votes"
              : session.votingMode === "scale"
                ? "Average Rating"
                : "Preference Count"}
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
        {imageStats.map((stat) => (
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
                          {playingAudio === r.audioFilename ? "Playing..." : `\u25B6 Recording`}
                        </button>
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
                src={`/api/uploads?file=${session.images.find((i) => i.id === pairwiseWinner.id)?.filename}`}
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
          <div className="flex gap-2 mb-6">
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
            <ResponsiveContainer width="100%" height={340}>
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

          {/* Head-to-head matrix */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 overflow-x-auto">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Head-to-Head Matrix</h3>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="p-2"></th>
                  {session.images.map((img, idx) => (
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
                {session.images.map((rowImg, rowIdx) => (
                  <tr key={rowImg.id} className="border-t border-gray-100">
                    <td className="p-2">
                      <img
                        src={`/api/uploads?file=${encodeURIComponent(rowImg.filename)}`}
                        alt={rowImg.label || `Image ${rowIdx + 1}`}
                        className="h-10 w-10 rounded-md object-cover"
                      />
                    </td>
                    {session.images.map((colImg) => {
                      if (rowImg.id === colImg.id) {
                        return (
                          <td key={colImg.id} className="p-2 text-center bg-gray-50 text-gray-300">
                            —
                          </td>
                        );
                      }
                      const record = getH2HRecord(rowImg.id, colImg.id);
                      let winnerId: string | null;
                      let bgColor: string;
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
                                    title="Play audio"
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
                {playingAudio === rec.audioFilename ? "Playing..." : `\u25B6 Participant`}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {responses.length === 0 && pairwiseResponses.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">No responses yet</p>
          <p className="text-sm mt-2">Share the session link to start collecting feedback</p>
        </div>
      )}
    </div>
  );
}
