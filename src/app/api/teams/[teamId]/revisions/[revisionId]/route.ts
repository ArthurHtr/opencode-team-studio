import { NextResponse } from "next/server";
import { listTeamRevisions, createAutomaticRevision, createManualRevision, renameTeamRevision, deleteTeamRevision, previewTeamRevision, getTeamRevision } from "@/lib/teams/revisions";
import type { TeamCreateManualRevisionInput, TeamRenameRevisionInput } from "@/lib/types";

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
    const body = await request.json() as { kind?: string; reason?: string; label?: string; description?: string };

    if (body.kind === "manual") {
      const input: TeamCreateManualRevisionInput = {
        kind: "manual",
        label: body.label || "",
        description: body.description,
      };
      if (!input.label.trim()) throw new Error("Label is required for manual revisions");
      const revision = await createManualRevision(decodeURIComponent(teamId), input);
      return NextResponse.json(revision, { status: 201 });
    }

    // Default: automatic revision
    const reason = (body.reason || "before-save") as "before-save" | "before-switch" | "before-restore" | "before-destructive-operation" | "manual";
    const revision = await createAutomaticRevision(decodeURIComponent(teamId), reason);
    return NextResponse.json(revision, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

export async function GET_preview(_: Request, { params }: { params: Promise<{ teamId: string; revisionId: string }> }) {
  try {
    const { teamId, revisionId } = await params;
    const preview = await previewTeamRevision(decodeURIComponent(teamId), decodeURIComponent(revisionId));
    return NextResponse.json(preview);
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 404 });
  }
}

export async function GET_revision(_: Request, { params }: { params: Promise<{ teamId: string; revisionId: string }> }) {
  try {
    const { teamId, revisionId } = await params;
    const revision = await getTeamRevision(decodeURIComponent(teamId), decodeURIComponent(revisionId));
    return NextResponse.json(revision);
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 404 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ teamId: string; revisionId: string }> }) {
  try {
    const { teamId, revisionId } = await params;
    const body = await request.json() as TeamRenameRevisionInput;
    const revision = await renameTeamRevision(decodeURIComponent(teamId), decodeURIComponent(revisionId), body);
    return NextResponse.json(revision);
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ teamId: string; revisionId: string }> }) {
  try {
    const { teamId, revisionId } = await params;
    await deleteTeamRevision(decodeURIComponent(teamId), decodeURIComponent(revisionId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

function message(error: unknown) { return error instanceof Error ? error.message : "Unknown error"; }
