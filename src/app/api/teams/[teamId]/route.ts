import { NextResponse } from "next/server";
import { renameTeam, deleteTeam } from "@/lib/teams/storage";
import { getTeamById, getTeamsRegistry } from "@/lib/teams/registry";
import { listTeamRevisions } from "@/lib/teams/revisions";
import type { TeamListItem, TeamRenameInput } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params;
    const team = await getTeamById(decodeURIComponent(teamId));
    if (!team) return NextResponse.json({ error: "Team not found" }, { status: 404 });

    const registry = await getTeamsRegistry();
    const revisionCount = (await listTeamRevisions(team.id)).length;
    const item: TeamListItem = {
      ...team,
      active: team.id === registry.activeTeamId,
      agentCount: 0,
      revisionCount,
    };
    return NextResponse.json(item);
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params;
    const body = await request.json() as TeamRenameInput;
    if (!body?.name) throw new Error("Name is required");

    const team = await renameTeam(decodeURIComponent(teamId), body.name);
    return NextResponse.json(team);
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params;
    await deleteTeam(decodeURIComponent(teamId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

function message(error: unknown) { return error instanceof Error ? error.message : "Unknown error"; }
