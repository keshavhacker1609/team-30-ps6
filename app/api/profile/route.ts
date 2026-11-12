import { NextResponse } from "next/server";
import { CURRENT_USER_ID } from "@/lib/currentUser";
import { getSupabase } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("id, name, degree, branch, grad_year, cgpa, preferred_cities, skills, interests")
    .eq("id", CURRENT_USER_ID)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  return NextResponse.json({ profile: data });
}
