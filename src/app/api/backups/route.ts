import { NextResponse } from "next/server";
import { listConfigBackups } from "@/lib/backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await listConfigBackups());
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}
function message(error: unknown) { return error instanceof Error ? error.message : "Erreur inconnue"; }
