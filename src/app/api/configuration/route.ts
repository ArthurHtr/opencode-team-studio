import { NextResponse } from "next/server";
import { getConfigDocument, replaceConfigObjectPreservingFormatting } from "@/lib/config-store";
import { withConfigTransaction } from "@/lib/backup";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json((await getConfigDocument()).value);
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Configuration invalide");
    await withConfigTransaction("Modification de la configuration globale", async () => {
      await replaceConfigObjectPreservingFormatting(body as Record<string, unknown>);
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Erreur inconnue";
}
