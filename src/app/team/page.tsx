import { EmptyConfigWelcome } from "@/components/empty-config-welcome";
import { TeamStudio } from "@/components/team/team-studio";
import { getTeamSnapshot } from "@/lib/team/store";
export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const snapshot = await getTeamSnapshot();
  const hasCustomAgents = snapshot.agents.some((a) => a.source === "file");
  const hasCustomSkills = snapshot.skills.length > 0;
  const hasCustomMcps = snapshot.mcps.length > 0;
  const hasProviders = snapshot.providers.length > 0;

  if (!hasCustomAgents && !hasCustomSkills && !hasCustomMcps && !hasProviders) {
    return <EmptyConfigWelcome />;
  }

  return <TeamStudio initial={snapshot} />;
}
