import { NextResponse } from "next/server";
import { duplicateTeam } from "@/lib/teams/storage";

export async function POST(request: Request, { params }: { params: Promise<{ teamId: string }> }) {
  try {
    const { teamId } = await params;
    const body = await request.json() as { name: string };
    if (!body?.name) throw new Error("Name is required");

    const team = await duplicateTeam(decodeURIComponent(teamId), body.name);
    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

function message(error: unknown) { return error instanceof Error ? error.message : "Unknown error"; }
