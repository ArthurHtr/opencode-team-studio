import { NextResponse } from "next/server";
import { getTeamSnapshot, saveSkill } from "@/lib/team/store";
import type { SkillDefinition } from "@/lib/types";

export async function GET() {
  try { return NextResponse.json((await getTeamSnapshot()).skills); }
  catch (error) { return NextResponse.json({ error: message(error) }, { status: 500 }); }
}
export async function POST(request: Request) {
  try { return NextResponse.json(await saveSkill(await request.json() as SkillDefinition), { status: 201 }); }
  catch (error) { return NextResponse.json({ error: message(error) }, { status: 400 }); }
}
function message(error: unknown) { return error instanceof Error ? error.message : "Erreur inconnue"; }
