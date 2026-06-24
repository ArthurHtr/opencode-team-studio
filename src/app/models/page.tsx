import { ModelsStudio } from "@/components/models/models-studio";
import { getConfigDocument } from "@/lib/config-store";
import { getTeamSnapshot } from "@/lib/team/store";
export const dynamic = "force-dynamic";
export default async function ModelsPage() { const [config, team] = await Promise.all([getConfigDocument(), getTeamSnapshot()]); return <ModelsStudio initialConfig={config.value} agents={team.agents} />; }
