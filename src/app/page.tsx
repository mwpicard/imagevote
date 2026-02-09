"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function handleGo() {
    const trimmed = code.trim();
    if (trimmed) {
      router.push(`/s/${trimmed}`);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <main className="flex w-full max-w-md flex-col items-center gap-10 px-6 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
            ImageVote
          </h1>
          <p className="mt-2 text-lg text-zinc-500">
            Create and share image voting surveys
          </p>
        </div>

        <Link
          href="/admin/projects/new"
          className="flex h-12 w-full items-center justify-center rounded-lg bg-blue-600 text-base font-medium text-white transition-colors hover:bg-blue-700"
        >
          Create New Project
        </Link>

        <div className="w-full">
          <div className="relative mb-2 flex items-center text-center text-sm text-zinc-400 before:mr-3 before:flex-1 before:border-t before:border-zinc-200 after:ml-3 after:flex-1 after:border-t after:border-zinc-200">
            or join an existing one
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter survey code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleGo();
              }}
              className="h-12 flex-1 rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <button
              onClick={handleGo}
              className="h-12 rounded-lg bg-zinc-800 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-700"
            >
              Go
            </button>
          </div>
        </div>

        <Link
          href="/admin/projects"
          className="text-sm text-zinc-500 underline underline-offset-2 transition-colors hover:text-zinc-700"
        >
          View all projects
        </Link>
      </main>
    </div>
  );
}
