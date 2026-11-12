import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";

/** GET /api/health  -> shows which settings are missing (never shows the values). */
export async function GET() {
  // GEMINI_MODEL is optional (it has a default), so it is not checked here.
  const names = ["GEMINI_API_KEY", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "APP_PASSCODE"];
  const settings = Object.fromEntries(names.map((n) => [n, Boolean(process.env[n]?.trim())]));
  let jobsAvailable = false;
  let jobsError: string | undefined;

  if (settings.SUPABASE_URL && settings.SUPABASE_SECRET_KEY) {
    const { error } = await getSupabase().from("jobs").select("id").limit(1);
    jobsAvailable = !error;
    if (error) jobsError = error.message;
  }

  const ok = Object.values(settings).every(Boolean) && jobsAvailable;
  return NextResponse.json(
    { ok, settings, database: { jobs: jobsAvailable, ...(jobsError ? { error: jobsError } : {}) } },
    { status: ok ? 200 : 503 }
  );
}
