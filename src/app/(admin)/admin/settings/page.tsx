// File: src/app/(admin)/admin/settings/page.tsx
// (REPLACE the whole file)

import { requireRole } from "@/lib/auth/session";
import {
  getChecklist,
  getOffloadAlertEmails,
  getOffloadForms,
  getSalesSettings,
  getScoring,
  getSettings,
  getUsers,
} from "@/lib/data";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { ScoringForm } from "@/components/fleet/scoring-form";
import { SalesSettingsForm } from "@/components/admin/sales-settings-form";
import { OffloadSettingsForm } from "@/components/admin/offload-settings-form";
import { ChecklistSettingsForm } from "@/components/fleet/checklist-settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireRole("admin");
  const [
    settings,
    users,
    scoring,
    sales,
    offloadForms,
    offloadEmails,
    checklist,
  ] = await Promise.all([
    getSettings(),
    getUsers(),
    getScoring(),
    getSalesSettings(),
    getOffloadForms(true),
    getOffloadAlertEmails(),
    getChecklist(),
  ]);
  const admins = users
    .filter((u) => u.role === "admin" && u.active)
    .map((u) => ({ id: u.id, name: u.name, email: u.email }));

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Company details, notifications, offload paperwork, the pre-trip checklist, driver scoring and the sales leaderboard."
      />
      <SettingsForm settings={settings} admins={admins} />
      <OffloadSettingsForm forms={offloadForms} alertEmails={offloadEmails} />
      <ChecklistSettingsForm items={checklist} />
      <ScoringForm scoring={scoring} />
      <SalesSettingsForm settings={sales} />
    </div>
  );
}
