import { ResourcesStudio } from "@/components/resources/resources-studio";
import { getTeamSnapshot } from "@/lib/team/store";
export const dynamic = "force-dynamic";
export default async function ResourcesPage() { return <ResourcesStudio initial={await getTeamSnapshot()} />; }
