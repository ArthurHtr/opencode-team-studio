import { NextResponse } from "next/server";
import { applyTeamDraft } from "@/lib/team/store";
import type { TeamApplyInput } from "@/lib/types";

export async function PUT(request: Request) {
  try {
    const body = await request.json() as TeamApplyInput;
    if (!body?.snapshot || !body?.layout) throw new Error("Équipe ou disposition manquante");
    return NextResponse.json(await applyTeamDraft(body));
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Erreur inconnue";
}
