import { NextResponse } from "next/server";
import { listTeams, getTeamsRegistry } from "@/lib/teams/registry";
import { listTeamRevisions } from "@/lib/teams/revisions";
import { createTeam, duplicateTeam } from "@/lib/teams/storage";
import type { TeamListItem, TeamActivationInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const teams = await listTeams();
    const registry = await getTeamsRegistry();
    const items: TeamListItem[] = [];
    for (const team of teams) {
      const revisionCount = (await listTeamRevisions(team.id)).length;
      items.push({
        ...team,
        active: team.id === registry.activeTeamId,
        agentCount: 0,
        revisionCount,
      });
    }
    return NextResponse.json(items);
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as TeamActivationInput;
    if (!body?.name) throw new Error("Team name is required");

    let team;
    if (body.mode === "duplicate-active") {
      team = await duplicateTeam("active", body.name);
    } else if (body.mode === "duplicate-team") {
      if (!body.sourceTeamId) throw new Error("sourceTeamId is required for duplicate-team mode");
      team = await duplicateTeam(body.sourceTeamId, body.name);
    } else {
      team = await createTeam(body.name, body.description, "empty");
    }

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

function message(error: unknown) { return error instanceof Error ? error.message : "Unknown error"; }
