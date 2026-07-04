import { BackupsPage } from "@/components/backups/backups-page";

export const dynamic = "force-dynamic";

export default async function BackupsRoute() {
  return <BackupsPage />;
}
