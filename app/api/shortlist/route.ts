import { NextResponse } from "next/server";
import { CURRENT_USER_ID } from "@/lib/currentUser";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getJobDetails(value: unknown) {
  const job = Array.isArray(value) ? value[0] : value;
  if (
    typeof job === "object" &&
    job !== null &&
    "id" in job &&
    typeof job.id === "number" &&
    "title" in job &&
    typeof job.title === "string" &&
    "company" in job &&
    typeof job.company === "string" &&
    "city" in job &&
    typeof job.city === "string"
  ) {
    return { id: job.id, title: job.title, company: job.company, city: job.city };
  }
}

export async function GET() {
  const { data, error } = await getSupabase()
    .from("shortlists")
    .select("job_id, match_score, reason, created_at, jobs(id, title, company, city)")
    .eq("profile_id", CURRENT_USER_ID)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const shortlists = data.map((item) => {
    const job = getJobDetails(item.jobs);
    if (!job) throw new Error(`No job found with id ${item.job_id}`);
    return {
      job_id: item.job_id,
      title: job.title,
      company: job.company,
      city: job.city,
      match_score: item.match_score,
      reason: item.reason,
      created_at: item.created_at,
    };
  });

  return NextResponse.json({ shortlists });
}
