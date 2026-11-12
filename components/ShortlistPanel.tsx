"use client";

import { useEffect, useState } from "react";

type ShortlistItem = {
  job_id: number;
  title: string;
  company: string;
  city: string;
  match_score: number | null;
  reason: string | null;
  created_at: string;
};

function scoreColor(score: number | null): string {
  if (score === null) return "bg-slate-100 text-slate-700";
  if (score >= 70) return "bg-emerald-100 text-emerald-800";
  if (score >= 40) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
}

export default function ShortlistPanel({ refreshKey }: { refreshKey: number }) {
  const [shortlists, setShortlists] = useState<ShortlistItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadShortlist() {
      try {
        const response = await fetch("/api/shortlist", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load shortlist");
        if (active) {
          setShortlists(data.shortlists);
          setError("");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load shortlist");
      }
    }

    void loadShortlist();
    const intervalId = window.setInterval(() => void loadShortlist(), 5000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [refreshKey]);

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold">My shortlist</h2>
      </div>
      <ul className="divide-y divide-slate-100">
        {error && <li className="p-4 text-sm text-red-600">{error}</li>}
        {!error && shortlists.length === 0 && (
          <li className="p-4 text-sm text-slate-500">No jobs in your shortlist yet.</li>
        )}
        {shortlists.map((item) => (
          <li key={item.job_id} className="flex min-w-0 items-start justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="break-words font-medium text-slate-900">{item.title}</p>
              <p className="break-words text-sm text-slate-600">{item.company}</p>
              <p className="break-words text-xs text-slate-500">{item.city}</p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${scoreColor(item.match_score)}`}
            >
              {item.match_score ?? "—"}% match
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
