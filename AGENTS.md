# CareerMatch project instructions

- Problem: PS6 Job Match Agent (CareerMatch), for final-year student Divya K (logged-in user S001).
- Stack: Next.js App Router, TypeScript, Tailwind, Supabase (server only; secret key), Gemini function calling, and Zod.
- Seed tables and columns:
  - `profiles`: `id`, `name`, `degree`, `branch`, `grad_year`, `cgpa`, `preferred_cities`, `skills`, `interests`.
  - `jobs`: `id`, `title`, `company`, `city`, `work_mode`, `job_type`, `min_cgpa`, `eligible_branches`, `required_skills`, `nice_to_have`, `salary_lpa_min`, `salary_lpa_max`, `apply_by`, `description`.
  - `shortlists`: `id`, `profile_id`, `job_id`, `match_score`, `reason`, `created_at`; `(profile_id, job_id)` is unique.
- Agent tools live in `lib/agent/tools.ts`; define each with `defineTool()` and a Zod schema. Tool descriptions must start with “Use this when...”.
- `CURRENT_USER_ID` comes from `lib/currentUser.ts`. Never accept or pass a user id as a tool argument.
- Eligibility: skip jobs if the student's CGPA is below `min_cgpa`, their `branch` is absent from `eligible_branches`, or `apply_by` has passed.
- Never shortlist the same job twice for a student.
- Compute match scores in code; do not ask the AI to calculate them.
- Never use the Supabase secret key in components. Never commit `.env.local`.
