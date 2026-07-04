import { NextResponse } from "next/server";
import { listTeamRevisions, createTeamRevision } from "@/lib/teams/revisions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params;
    const revisions = await listTeamRevisions(decodeURIComponent(teamId));
    return NextResponse.json(revisions);
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params;
    const body = await request.json() as { reason?: string };
    const revision = await createTeamRevision(decodeURIComponent(teamId), body?.reason);
    return NextResponse.json(revision, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

function message(error: unknown) { return error instanceof Error ? error.message : "Unknown error"; }
