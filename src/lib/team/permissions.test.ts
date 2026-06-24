import { describe, expect, it } from "vitest";
import { evaluatePermission, removePermissionTarget, renamePermissionTarget, setPermissionTarget } from "@/lib/team/permissions";

 describe("permissions OpenCode", () => {
  it("applique la dernière règle correspondante", () => {
    expect(evaluatePermission({ "*": "ask", "git *": "allow", "git push*": "deny" }, "git push origin main")).toBe("deny");
    expect(evaluatePermission({ "*": "ask", "git *": "allow" }, "git status")).toBe("allow");
  });

  it("ajoute et retire une cible sans perdre les autres règles", () => {
    const configured = setPermissionTarget({ task: { "*": "deny" } }, "task", "architect", "allow");
    expect(configured.task).toEqual({ "*": "deny", architect: "allow" });
    const inherited = setPermissionTarget(configured, "task", "architect", "inherit");
    expect(inherited.task).toEqual({ "*": "deny" });
  });

  it("renomme et supprime proprement une délégation", () => {
    const initial = { task: { "*": "deny" as const, architect: "allow" as const } };
    const renamed = renamePermissionTarget(initial, "task", "architect", "system-architect");
    expect(renamed.task).toEqual({ "*": "deny", "system-architect": "allow" });
    expect(removePermissionTarget(renamed, "task", "system-architect").task).toEqual({ "*": "deny" });
  });
});
