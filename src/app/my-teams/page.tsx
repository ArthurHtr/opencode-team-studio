import { TeamsPage } from "@/components/teams/teams-page";

export const dynamic = "force-dynamic";

export default async function MyTeamsRoute() {
  return <TeamsPage />;
}
