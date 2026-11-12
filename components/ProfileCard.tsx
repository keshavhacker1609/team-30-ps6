"use client";

import { useEffect, useState } from "react";

type Profile = {
  name: string;
  degree: string;
  branch: string;
  cgpa: number;
  preferred_cities: string[];
  skills: string[];
};

export default function ProfileCard({ refreshKey }: { refreshKey: number }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        const response = await fetch("/api/profile", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Could not load profile");
        if (active) {
          setProfile(data.profile);
          setError("");
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load profile");
      }
    }

    void loadProfile();
    const intervalId = window.setInterval(() => void loadProfile(), 5000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [refreshKey]);

  return (
    <section className="min-w-0 overflow-hidden rounded-xl bg-slate-900 p-4 text-white">
      <h2 className="font-semibold">My profile</h2>
      {error && <p className="mt-3 break-words text-sm text-red-300">{error}</p>}
      {!error && !profile && <p className="mt-3 text-sm text-slate-300">Loading profile...</p>}
      {profile && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="break-words text-lg font-semibold">{profile.name}</p>
            <p className="break-words text-sm text-slate-300">
              {profile.degree} · {profile.branch}
            </p>
          </div>
          <p className="text-sm">
            CGPA <span className="font-semibold">{profile.cgpa}</span>
          </p>
          <div className="flex flex-wrap gap-1.5" aria-label="Preferred cities">
            {profile.preferred_cities.map((city) => (
              <span key={city} className="max-w-full break-words rounded-full bg-slate-700 px-2.5 py-1 text-xs">
                {city}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5" aria-label="Skills">
            {profile.skills.map((skill) => (
              <span key={skill} className="max-w-full break-words rounded-full bg-slate-700 px-2.5 py-1 text-xs">
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
