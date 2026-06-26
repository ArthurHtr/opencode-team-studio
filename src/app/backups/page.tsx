import { BackupsStudio } from "@/components/backups/backups-studio";
import { listConfigBackups } from "@/lib/backup";

export const dynamic = "force-dynamic";

export default async function BackupsPage() {
  return <BackupsStudio initial={await listConfigBackups()} />;
}
