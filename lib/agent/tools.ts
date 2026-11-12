import "server-only";
import { z } from "zod";
import { CURRENT_USER_ID } from "../currentUser";
import { todayInIndia } from "../dates";
import { scoreJobMatch } from "../jobMatch";
import { getSupabase } from "../supabase";
import { defineTool, type AgentTool } from "./defineTool";

function getJoinedJobDetails(value: unknown) {
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

async function getCurrentProfile() {
  const { data, error } = await getSupabase()
    .from("profiles")
    .select("id, name, degree, branch, grad_year, cgpa, preferred_cities, skills, interests")
    .eq("id", CURRENT_USER_ID)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`No profile found for ${CURRENT_USER_ID}`);
  return data;
}

const getMyProfile = defineTool({
  name: "getMyProfile",
  description:
    "Use this when the user asks about their profile, skills, branch, CGPA, or preferred cities.",
  schema: z.object({}),
  run: async () => ({ profile: await getCurrentProfile() }),
});

const searchJobs = defineTool({
  name: "searchJobs",
  description:
    "Use this when the user wants to find eligible jobs. Optionally filter by city or a keyword in the job title or company.",
  schema: z.object({
    city: z.string().trim().min(1).optional().describe("Exact job city to filter by"),
    keyword: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe("Case-insensitive text to match in the job title or company"),
    limit: z.number().int().min(1).max(20).default(10).describe("Maximum jobs to return (1-20)"),
  }),
  run: async ({ city, keyword, limit }) => {
    const profile = await getCurrentProfile();
    let query = getSupabase()
      .from("jobs")
      .select(
        "id, title, company, city, work_mode, job_type, min_cgpa, eligible_branches, required_skills, nice_to_have, salary_lpa_min, salary_lpa_max, apply_by"
      )
      .lte("min_cgpa", profile.cgpa)
      .contains("eligible_branches", [profile.branch])
      .gte("apply_by", todayInIndia());
    if (city) query = query.eq("city", city);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const normalizedKeyword = keyword?.toLowerCase();
    const jobs = data
      .filter(
        (job) =>
          !normalizedKeyword ||
          job.title.toLowerCase().includes(normalizedKeyword) ||
          job.company.toLowerCase().includes(normalizedKeyword)
      )
      .map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        city: job.city,
        work_mode: job.work_mode,
        job_type: job.job_type,
        min_cgpa: job.min_cgpa,
        salary_lpa_min: job.salary_lpa_min,
        salary_lpa_max: job.salary_lpa_max,
        apply_by: job.apply_by,
        ...scoreJobMatch(job.required_skills, job.nice_to_have, profile.skills),
      }))
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, limit);

    return { count: jobs.length, jobs };
  },
});

const getMyShortlist = defineTool({
  name: "getMyShortlist",
  description: "Use this when the user asks to see jobs they have shortlisted.",
  schema: z.object({}),
  run: async () => {
    const { data, error } = await getSupabase()
      .from("shortlists")
      .select("job_id, match_score, created_at, jobs(id, title, company, city)")
      .eq("profile_id", CURRENT_USER_ID)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    return {
      shortlists: data.map((item) => {
        const job = getJoinedJobDetails(item.jobs);
        if (!job) throw new Error(`No job found with id ${item.job_id}`);
        return {
          job_id: item.job_id,
          title: job.title,
          company: job.company,
          city: job.city,
          score: item.match_score,
          saved_date: item.created_at,
        };
      }),
    };
  },
});

export const tools: AgentTool[] = [getMyProfile, searchJobs, getMyShortlist];
