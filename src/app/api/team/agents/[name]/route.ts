import { NextResponse } from "next/server";
import { deleteAgent, getAgent, saveAgent } from "@/lib/team/store";
import type { AgentDefinition } from "@/lib/types";

export async function GET(_: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    return NextResponse.json(await getAgent(decodeURIComponent(name)));
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 404 });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    const body = await request.json() as AgentDefinition;
    return NextResponse.json(await saveAgent(body, decodeURIComponent(name)));
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ name: string }> }) {
  try {
    const { name } = await params;
    await deleteAgent(decodeURIComponent(name));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}
function message(error: unknown) { return error instanceof Error ? error.message : "Erreur inconnue"; }
