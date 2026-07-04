/**
 * Generate a safe filename slug from a team name.
 * Produces a lowercase, ASCII-only slug with hyphens.
 * Falls back to "team-summary" if the result would be empty.
 */
export function slugifyTeamName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "team-summary";

  // Convert to lowercase
  let slug = trimmed.toLowerCase();

  // Replace spaces and common separators with hyphens
  slug = slug.replace(/[\s_]+/g, "-");

  // Remove characters that are not safe for filenames
  slug = slug.replace(/[^a-z0-9-]/g, "");

  // Collapse multiple hyphens
  slug = slug.replace(/-+/g, "-");

  // Remove leading/trailing hyphens
  slug = slug.replace(/^-+|-+$/g, "");

  if (!slug) return "team-summary";
  return slug;
}

/**
 * Generate a download filename for a team summary.
 * Format: <team-slug>-summary.md
 */
export function summaryFilename(teamName: string): string {
  return `${slugifyTeamName(teamName)}-summary.md`;
}
