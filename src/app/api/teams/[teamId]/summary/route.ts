import { NextResponse } from "next/server";
import { generateTeamSummary } from "@/lib/team/summary";
import { getTeamById } from "@/lib/teams/registry";
import { loadTeamProfileSnapshot } from "@/lib/teams/profile-snapshot";
import { summaryFilename } from "@/lib/teams/summary-filename";
import { validateTeamId } from "@/lib/teams/validation";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> },
) {
  try {
    const { teamId } = await params;

    if (!teamId) {
      return NextResponse.json({ error: "Team identifier is required" }, { status: 400 });
    }

    // Validate teamId format
    try {
      validateTeamId(teamId);
    } catch {
      return NextResponse.json({ error: "Team identifier must be a valid UUID v4" }, { status: 400 });
    }

    // Verify team exists
    const team = await getTeamById(teamId);
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Load snapshot from stored profile (does not activate the team)
    const snapshot = await loadTeamProfileSnapshot(teamId);

    // Generate Markdown summary
    const markdown = generateTeamSummary(snapshot);

    // Generate safe filename
    const filename = summaryFilename(team.name);

    return NextResponse.json({
      teamId,
      teamName: team.name,
      markdown,
      filename,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
