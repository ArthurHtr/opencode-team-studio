import { NextResponse } from "next/server";
import { deleteSkill, saveSkill } from "@/lib/team/store";
import type { SkillDefinition } from "@/lib/types";

export async function PUT(request: Request, { params }: { params: Promise<{ name: string }> }) {
  try { const { name } = await params; return NextResponse.json(await saveSkill(await request.json() as SkillDefinition, decodeURIComponent(name))); }
  catch (error) { return NextResponse.json({ error: message(error) }, { status: 400 }); }
}
export async function DELETE(_: Request, { params }: { params: Promise<{ name: string }> }) {
  try { const { name } = await params; await deleteSkill(decodeURIComponent(name)); return NextResponse.json({ ok: true }); }
  catch (error) { return NextResponse.json({ error: message(error) }, { status: 400 }); }
}
function message(error: unknown) { return error instanceof Error ? error.message : "Erreur inconnue"; }
