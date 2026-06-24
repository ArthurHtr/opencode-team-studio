import { NextResponse } from "next/server";
import { saveAgentPermission, getAgent } from "@/lib/team/store";
import { setPermissionTarget, setPermissionValue } from "@/lib/team/permissions";
import type { PermissionAction, RelationKind } from "@/lib/types";

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { source: string; target: string; kind: RelationKind; action: PermissionAction | "inherit" };
    if (!body.source || !body.target) throw new Error("Relation incomplète");
    const agent = await getAgent(body.source);
    let permission;
    if (body.kind === "tool") {
      permission = setPermissionValue(agent.permission, body.target, body.action === "inherit" ? undefined : body.action);
    } else {
      const key = body.kind === "mcp" ? `${body.target}_*` : body.kind;
      const target = body.kind === "mcp" ? "*" : body.target;
      permission = setPermissionTarget(agent.permission, key, target, body.action);
    }
    return NextResponse.json(await saveAgentPermission(agent.name, permission));
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }
}
function message(error: unknown) { return error instanceof Error ? error.message : "Erreur inconnue"; }
