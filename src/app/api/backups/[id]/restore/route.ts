import { NextResponse } from "next/server";
import { createConfigBackup, restoreConfigBackup } from "@/lib/backup";

export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await createConfigBackup(`Avant restauration du backup ${id}`);
    await restoreConfigBackup(decodeURIComponent(id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}
function message(error: unknown) { return error instanceof Error ? error.message : "Erreur inconnue"; }
