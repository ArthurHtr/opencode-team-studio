import { NextResponse } from "next/server";
import { activateTeam } from "@/lib/teams/activation";

export async function POST(_: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params;
    await activateTeam(decodeURIComponent(teamId));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

function message(error: unknown) { return error instanceof Error ? error.message : "Unknown error"; }
