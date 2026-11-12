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
    limit: z.number().int().min(1).max(8).default(8).describe("Maximum jobs to return (1-8)"),
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
      .map((job) => {
        const { match_score, missing_skills } = scoreJobMatch(
          job.required_skills,
          job.nice_to_have,
          profile.skills
        );
        return {
          id: job.id,
          title: job.title,
          company: job.company,
          city: job.city,
          match_score,
          missing_skills,
        };
      })
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, Math.min(limit, 8));

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
      .select("job_id, match_score, reason, created_at, jobs(id, title, company, city)")
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
          match_score: item.match_score,
          reason: item.reason,
          saved_date: item.created_at,
        };
      }),
    };
  },
});

const saveToShortlist = defineTool({
  name: "saveToShortlist",
  description: "Use this when the student asks to save, shortlist or bookmark jobs.",
  writes: true,
  schema: z.object({
    job_ids: z
      .array(z.number().int().positive())
      .min(1)
      .max(5)
      .refine((jobIds) => new Set(jobIds).size === jobIds.length, "Job ids must be unique")
      .describe("One to five unique job ids"),
  }),
  run: async ({ job_ids }) => {
    const profile = await getCurrentProfile();
    const savedJobs = [];

    for (const jobId of job_ids) {
      const { data: job, error: jobError } = await getSupabase()
        .from("jobs")
        .select(
          "id, title, company, min_cgpa, eligible_branches, required_skills, nice_to_have, apply_by"
        )
        .eq("id", jobId)
        .maybeSingle();
      if (jobError) throw new Error(jobError.message);
      if (!job) throw new Error(`Job ${jobId} not found`);
      if (profile.cgpa < job.min_cgpa) {
        throw new Error(
          `Your CGPA ${profile.cgpa} is below the required ${job.min_cgpa} for ${job.title}`
        );
      }
      if (!job.eligible_branches.includes(profile.branch)) {
        throw new Error(`${job.title} is only open to ${job.eligible_branches.join(", ")}`);
      }
      if (job.apply_by < todayInIndia()) {
        throw new Error(`Applications for ${job.title} closed on ${job.apply_by}`);
      }

      const { data: existing, error: shortlistError } = await getSupabase()
        .from("shortlists")
        .select("id")
        .eq("profile_id", CURRENT_USER_ID)
        .eq("job_id", jobId)
        .maybeSingle();
      if (shortlistError) throw new Error(shortlistError.message);
      if (existing) throw new Error(`${job.title} is already in your shortlist`);

      const match = scoreJobMatch(job.required_skills, job.nice_to_have, profile.skills);
      savedJobs.push({
        job_id: job.id,
        title: job.title,
        company: job.company,
        match_score: match.match_score,
        reason: `Matched: ${match.matched_skills.join(", ") || "none"}. Missing: ${match.missing_skills.join(", ") || "none"}`,
      });
    }

    const { error } = await getSupabase()
      .from("shortlists")
      .insert(
        savedJobs.map((job) => ({
          profile_id: CURRENT_USER_ID,
          job_id: job.job_id,
          match_score: job.match_score,
          reason: job.reason,
        }))
      );
    if (error) throw new Error(error.message);

    return {
      saved: savedJobs.map(({ title, company, match_score, reason }) => ({
        title,
        company,
        match_score,
        reason,
      })),
    };
  },
});

const updateMySkills = defineTool({
  name: "updateMySkills",
  description:
    "Use this when the student says they learned a new skill or wants to add skills to their profile.",
  writes: true,
  schema: z.object({
    add_skills: z
      .array(z.string().trim().min(1).max(40))
      .min(1)
      .max(10)
      .describe("One to ten skills to add, each 1-40 characters"),
  }),
  run: async ({ add_skills }) => {
    const profile = await getCurrentProfile();
    const skills = [...profile.skills];
    const knownSkills = new Set(skills.map((skill) => skill.toLowerCase()));
    for (const skill of add_skills) {
      const normalizedSkill = skill.trim();
      const key = normalizedSkill.toLowerCase();
      if (!knownSkills.has(key)) {
        skills.push(normalizedSkill);
        knownSkills.add(key);
      }
    }

    const { data, error } = await getSupabase()
      .from("profiles")
      .update({ skills })
      .eq("id", CURRENT_USER_ID)
      .select("skills")
      .single();
    if (error) throw new Error(error.message);

    return { skills: data.skills };
  },
});

export const tools: AgentTool[] = [
  getMyProfile,
  searchJobs,
  getMyShortlist,
  saveToShortlist,
  updateMySkills,
];
