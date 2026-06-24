import { NextResponse } from "next/server";
import { getTeamSnapshot } from "@/lib/team/store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getTeamSnapshot());
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

function message(error: unknown) { return error instanceof Error ? error.message : "Erreur inconnue"; }
