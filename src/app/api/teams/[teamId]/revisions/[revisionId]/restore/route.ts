import { NextResponse } from "next/server";
import { restoreTeamRevision } from "@/lib/teams/revisions";

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string; revisionId: string }> }) {
  try {
    const { teamId, revisionId } = await params;
    await restoreTeamRevision(decodeURIComponent(teamId), decodeURIComponent(revisionId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

function message(error: unknown) { return error instanceof Error ? error.message : "Unknown error"; }
