import { ConfigurationStudio } from "@/components/configuration/configuration-studio";
import { getConfigDocument } from "@/lib/config-store";
import { getTeamSnapshot } from "@/lib/team/store";
export const dynamic = "force-dynamic";
export default async function ConfigurationPage() { const [config, team] = await Promise.all([getConfigDocument(), getTeamSnapshot()]); return <ConfigurationStudio initialConfig={config.value} snapshot={team} />; }
