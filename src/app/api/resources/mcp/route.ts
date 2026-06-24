import { NextResponse } from "next/server";
import { getTeamSnapshot, saveMcp } from "@/lib/team/store";
import type { McpDefinition } from "@/lib/types";

export async function GET() {
  try { return NextResponse.json((await getTeamSnapshot()).mcps); }
  catch (error) { return NextResponse.json({ error: message(error) }, { status: 500 }); }
}
export async function POST(request: Request) {
  try { return NextResponse.json(await saveMcp(await request.json() as McpDefinition), { status: 201 }); }
  catch (error) { return NextResponse.json({ error: message(error) }, { status: 400 }); }
}
function message(error: unknown) { return error instanceof Error ? error.message : "Erreur inconnue"; }
