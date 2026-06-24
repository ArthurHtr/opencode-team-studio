import { NextResponse } from "next/server";
import { createAgent } from "@/lib/team/store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const agent = await createAgent({
      name: String(body.name || "").trim(),
      description: String(body.description || "").trim(),
      mode: body.mode === "primary" || body.mode === "all" ? body.mode : "subagent",
      preset: String(body.preset || "readonly"),
    });
    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}
function message(error: unknown) { return error instanceof Error ? error.message : "Erreur inconnue"; }
