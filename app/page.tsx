"use client";

import { useState } from "react";
import AgentChat from "@/components/AgentChat";
import ProfileCard from "@/components/ProfileCard";
import ShortlistPanel from "@/components/ShortlistPanel";

export default function HomePage() {
  const [refreshKey, setRefreshKey] = useState(0);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-6">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold">CareerMatch · AI job match agent</h1>
          <p className="text-sm text-slate-500">
            Find eligible jobs, see missing skills, build your shortlist.
          </p>
        </div>
        <button
          onClick={logout}
          className="shrink-0 whitespace-nowrap text-sm text-slate-500 hover:text-slate-900"
        >
          Log out
        </button>
      </header>
      <div className="grid gap-4 md:grid-cols-5">
        <section className="md:col-span-3">
          <AgentChat onDataChanged={() => setRefreshKey((k) => k + 1)} />
        </section>
        <section className="min-w-0 space-y-4 md:col-span-2">
          <ProfileCard refreshKey={refreshKey} />
          <ShortlistPanel refreshKey={refreshKey} />
        </section>
      </div>
    </main>
  );
}
