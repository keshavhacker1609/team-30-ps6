export type JobSkillMatch = {
  match_score: number;
  matched_skills: string[];
  missing_skills: string[];
};

export function scoreJobMatch(
  requiredSkills: string[],
  niceToHaveSkills: string[],
  profileSkills: string[]
): JobSkillMatch {
  const studentSkills = new Set(profileSkills.map((skill) => skill.toLowerCase()));
  const matched_skills = requiredSkills.filter((skill) =>
    studentSkills.has(skill.toLowerCase())
  );
  const missing_skills = requiredSkills.filter(
    (skill) => !studentSkills.has(skill.toLowerCase())
  );
  const requiredScore = requiredSkills.length
    ? Math.round((matched_skills.length / requiredSkills.length) * 100)
    : 0;
  const niceToHaveMatches = niceToHaveSkills.filter((skill) =>
    studentSkills.has(skill.toLowerCase())
  ).length;
  const bonusScore = niceToHaveSkills.length
    ? Math.round((niceToHaveMatches / niceToHaveSkills.length) * 10)
    : 0;

  return {
    match_score: Math.min(100, requiredScore + bonusScore),
    matched_skills,
    missing_skills,
  };
}
