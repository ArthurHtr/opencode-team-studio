import { TeamStudio } from "@/components/team/team-studio";
import { getTeamSnapshot } from "@/lib/team/store";
export const dynamic = "force-dynamic";
export default async function TeamPage() { return <TeamStudio initial={await getTeamSnapshot()} />; }
