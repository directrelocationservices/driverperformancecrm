// File: src/app/(admin)/admin/jobs/[id]/page.tsx
// (REPLACE the whole file)

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  CloudOff,
  DollarSign,
  Eye,
  EyeOff,
  FileDown,
  FileText,
  History,
  Lock,
  MapPin,
  MessageSquare,
  Headset,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  Star,
  User as UserIcon,
  Users,
} from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import {
  getAuditLog,
  getCarrierClaims,
  getCarriers,
  getJobDetail,
  getUsers,
  getRepForJobNumber,
} from "@/lib/data";
import { ClaimStatusPill } from "@/components/carriers/claim-status-pill";
import { ACTION_LABELS, diffLines } from "@/lib/audit";
import {
  formatCurrency,
  formatDate,
  formatDateTimeET,
  formatDestination,
  formatOrigin,
} from "@/lib/format";
import { Pill } from "@/components/shared/pill";
import { PhotoThumb } from "@/components/shared/photo-thumb";
import { VerifyToggle } from "@/components/admin/verify-toggle";
import { RecordActions } from "@/components/admin/record-actions";
import { PreDamageCorrection } from "@/components/admin/pre-damage-correction";
import { DamageCorrection } from "@/components/admin/damage-correction";
import { DamageNoteForm } from "@/components/admin/damage-note-form";
import { JobStatusForm } from "@/components/admin/job-status-form";
import { JobDocuments } from "@/components/admin/job-documents";
import { OffloadCard } from "@/components/shared/offload-card";
import { OffloadAdmin } from "@/components/admin/offload-admin";
import { ReviewAttribution } from "@/components/admin/review-attribution";
import {
  DAMAGE_ATTRIBUTION_LABELS,
  DAMAGE_SOURCE_LABELS,
  REVIEW_PLATFORM_LABELS,
  UPSELL_TYPE_LABELS,
  type AuditEntry,
} from "@/types";
import { cn } from "@/lib/utils";

function Section({
  title,
  icon: Icon,
  count,
  action,
  children,
  alwaysShow,
}: {
  title: string;
  icon: React.ElementType;
  count: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Show the children even when the count is 0 */
  alwaysShow?: boolean;
}) {
  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex items-center gap-2.5 border-b px-4 py-3.5 sm:px-5">
        <Icon className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-bold">{title}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
          {count}
        </span>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      <div className="p-4 sm:p-5">
        {count === 0 && !alwaysShow ? (
          <p className="py-3 text-center text-sm text-muted-foreground">
            Nothing recorded.
          </p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function DeletedPill({ at }: { at?: string | null }) {
  if (!at) return null;
  return <Pill tone="danger">Deleted {formatDate(at.slice(0, 10))}</Pill>;
}

function HistoryList({
  entries,
  names,
}: {
  entries: AuditEntry[];
  names: Record<string, string>;
}) {
  if (entries.length === 0) return null;
  return (
    <details className="group mt-3 rounded-lg border bg-muted/30">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold">
        <History className="h-4 w-4 text-muted-foreground" />
        Record history ({entries.length})
        <span className="ml-auto text-xs text-muted-foreground group-open:hidden">
          Show
        </span>
        <span className="ml-auto hidden text-xs text-muted-foreground group-open:inline">
          Hide
        </span>
      </summary>
      <ol className="space-y-3 border-t px-3 py-3">
        {entries.map((a) => (
          <li key={a.id} className="text-sm">
            <p className="font-semibold">
              {ACTION_LABELS[a.action]} by {names[a.changedBy] ?? "Unknown"}
              <span className="font-normal text-muted-foreground">
                {" "}
                · {formatDateTimeET(a.changedAt)}
              </span>
            </p>
            {a.reason && (
              <p className="text-muted-foreground">Reason: {a.reason}</p>
            )}
            {a.action !== "create" && (
              <ul className="mt-1 space-y-0.5">
                {diffLines(a.before, a.after).map((d) => (
                  <li key={d.field} className="text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {d.field}:
                    </span>{" "}
                    <span className="line-through">
                      {names[d.from] ?? d.from}
                    </span>{" "}
                    →{" "}
                    <span className="text-foreground">
                      {names[d.to] ?? d.to}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i <= value
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30",
          )}
        />
      ))}
    </div>
  );
}

export default async function AdminJobDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ deleted?: string }>;
}) {
  await requireRole("admin");
  const { id } = await params;
  const showDeleted = (await searchParams).deleted === "1";

  const job = await getJobDetail(id, { includeDeleted: showDeleted });
  if (!job) notFound();

  const [users, audit, carriers, claims, suggestedRepId] = await Promise.all([
    getUsers(),
    getAuditLog({ jobId: id }),
    getCarriers(),
    getCarrierClaims({ jobId: id }),
    getRepForJobNumber(job.jobNumber),
  ]);
  const repOptions = users
    .filter(
      (u) =>
        u.role === "sales_rep" &&
        (u.active || job.reviews.some((r) => r.repId === u.id)),
    )
    .map((u) => ({ id: u.id, name: u.name }));
  const carrierOptions = carriers
    .filter((c) => c.active || c.id === job.carrierId)
    .map((c) => ({ id: c.id, name: c.companyName }));
  const jobCarrier = carriers.find((c) => c.id === job.carrierId);
  const names = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const crew = job.crewIds
    .map((c) => names[c])
    .filter(Boolean)
    .join(", ");
  const historyFor = (entityId: string) =>
    audit.filter((a) => a.entityId === entityId);
  const activePreDamage = job.preDamages.filter((p) => !p.deletedAt).length;
  const documents = job.documents ?? [];
  const jobHistory = historyFor(job.id);
  const addedBy = jobHistory.find((h) => h.action === "create");

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`/admin/drivers/${job.driverId}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> {names[job.driverId] ?? "Driver"}
        </Link>
        <Link
          href={
            showDeleted
              ? `/admin/jobs/${job.id}`
              : `/admin/jobs/${job.id}?deleted=1`
          }
          scroll={false}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          {showDeleted ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          {showDeleted ? "Hide deleted" : "Show deleted"}
        </Link>
      </div>

      {/* Header */}
      <div className="overflow-hidden rounded-2xl bg-secondary text-white">
        <div className="h-1 bg-primary" />
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                Job number
              </p>
              {job.enteredBy && (
                <span className="rounded-full bg-sky-400/20 px-2.5 py-0.5 text-xs font-semibold text-sky-200">
                  Entered by {names[job.enteredBy] ?? "office"}
                  {addedBy && ` · ${formatDateTimeET(addedBy.changedAt)}`}
                </span>
              )}
            </div>
            <h1 className="mt-1 text-[28px] font-bold leading-none sm:text-4xl">
              {job.jobNumber}
            </h1>

            <div className="mt-4 flex min-w-0 items-center gap-2 text-base font-semibold sm:text-lg">
              <MapPin className="h-5 w-5 shrink-0 text-primary" />
              <span className="truncate">{formatOrigin(job)}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-white/50" />
              <span className="truncate">{formatDestination(job)}</span>
            </div>

            <div className="mt-4 grid gap-2 text-sm text-white/70 sm:grid-cols-3 sm:gap-6">
              <p className="flex items-center gap-2">
                <Calendar className="h-4 w-4" /> {formatDate(job.date)}
              </p>
              <p className="flex items-center gap-2">
                <UserIcon className="h-4 w-4" /> {names[job.driverId]}
              </p>
              <p className="flex min-w-0 items-center gap-2">
                <Users className="h-4 w-4 shrink-0" />{" "}
                <span className="truncate">{crew}</span>
              </p>
            </div>
            {(job.customerName || job.deliveryDate) && (
              <div className="mt-2 grid gap-2 text-sm text-white/70 sm:grid-cols-3 sm:gap-6">
                {job.customerName && (
                  <p className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4" /> Customer:{" "}
                    {job.customerName}
                  </p>
                )}
                {job.deliveryDate && (
                  <p className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" /> Delivery:{" "}
                    {formatDate(job.deliveryDate)}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
            <Link
              href={`/admin/jobs/${job.id}/edit`}
              className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-white/10 px-5 font-semibold text-white transition hover:bg-white/20"
            >
              <Pencil className="h-4 w-4" /> Edit job
            </Link>

            {activePreDamage > 0 ||
            (job.offloads ?? []).some((o) => !o.deletedAt) ? (
              <a
                href={`/admin/jobs/${job.id}/pdf`}
                target="_blank"
                rel="noreferrer"
                className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 font-semibold text-white shadow-lg shadow-primary/30 transition hover:bg-primary/90"
              >
                <FileDown className="h-5 w-5" /> Claims PDF
              </a>
            ) : (
              <span className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-white/10 px-5 text-sm font-semibold text-white/50">
                <FileDown className="h-5 w-5" /> No pre-damage to export
              </span>
            )}
          </div>
        </div>
      </div>

      <JobStatusForm job={job} carriers={carrierOptions} />

      {jobHistory.length > 0 && (
        <div className="-mt-2">
          <HistoryList entries={jobHistory} names={names} />
        </div>
      )}

      {job.deliveredBy === "partner" && (
        <Section
          title="Carrier claims"
          icon={Package}
          count={claims.length}
          action={
            jobCarrier ? (
              <Link
                href={`/admin/carriers/${jobCarrier.id}/claims/new?job=${job.id}`}
                className="flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-semibold transition hover:border-foreground/30"
              >
                <Plus className="h-4 w-4" /> Add claim
              </Link>
            ) : undefined
          }
        >
          <div className="divide-y">
            {claims.map((c) => (
              <Link
                key={c.id}
                href={`/admin/carriers/claims/${c.id}`}
                className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0 hover:text-primary"
              >
                <span className="font-semibold">{c.item}</span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  {formatCurrency(c.claimAmount)}
                  <ClaimStatusPill status={c.status} />
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* Pre-existing damage */}
      <Section
        title="Pre-existing damage"
        icon={Camera}
        count={job.preDamages.length}
        action={
          <Link
            href={`/admin/jobs/${job.id}/pre-damage/new`}
            className="flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-semibold transition hover:border-foreground/30"
          >
            <Plus className="h-4 w-4" /> Add
          </Link>
        }
      >
        <div className="space-y-4">
          {job.preDamages.map((p) => {
            const history = historyFor(p.id);
            const corrected = history.some((h) => h.action === "update");
            return (
              <article
                key={p.id}
                className={cn(
                  "rounded-xl border p-4",
                  p.deletedAt && "border-dashed opacity-60",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{p.item}</p>
                    <p className="text-sm text-muted-foreground">
                      {p.location}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Pill tone="dark">
                      <Lock className="h-3 w-3" /> Locked
                    </Pill>
                    {p.officeEntered && (
                      <Pill tone="primary">Entered by office</Pill>
                    )}
                    {corrected && <Pill tone="primary">Corrected</Pill>}
                    {p.syncedOffline && (
                      <Pill tone="warning">
                        <CloudOff className="h-3 w-3" /> Offline
                      </Pill>
                    )}
                    <DeletedPill at={p.deletedAt} />
                  </div>
                </div>

                <p className="mt-2 text-[15px]">{p.description}</p>
                {p.notes && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Note: {p.notes}
                  </p>
                )}

                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {p.photos.map((src, i) => (
                    <PhotoThumb
                      key={src + i}
                      src={src}
                      alt={`${p.item} photo ${i + 1}`}
                    />
                  ))}
                </div>

                <div className="mt-4 grid gap-3 rounded-lg bg-muted/50 p-3 text-sm md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Customer
                    </p>
                    <p className="mt-1 font-semibold">{p.customerName}</p>
                    <p className="text-muted-foreground">
                      Shown damage: {p.customerShown ? "Yes" : "No"}
                    </p>
                    {p.signatureUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.signatureUrl}
                        alt="Customer signature"
                        className="mt-2 h-14 rounded border bg-white object-contain p-1"
                      />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Record
                    </p>
                    {p.officeEntered || !p.capturedAtDevice ? (
                      <>
                        <p className="flex items-center gap-1.5">
                          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                          Entered by {names[p.createdBy ?? ""] ?? "office"}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />{" "}
                          {formatDateTimeET(p.receivedAtServer)}
                        </p>
                        <p className="text-muted-foreground">
                          Not captured on site: no device time or GPS
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />{" "}
                          Device: {formatDateTimeET(p.capturedAtDevice)}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />{" "}
                          Server: {formatDateTimeET(p.receivedAtServer)}
                        </p>
                      </>
                    )}
                    {p.officeEntered ? null : p.lat !== null &&
                      p.lng !== null ? (
                      <a
                        href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 font-medium text-primary hover:underline"
                      >
                        <MapPin className="h-3.5 w-3.5" /> {p.lat.toFixed(5)},{" "}
                        {p.lng.toFixed(5)}
                      </a>
                    ) : (
                      <p className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" /> No GPS
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-start justify-end gap-2">
                  {!p.deletedAt && <PreDamageCorrection record={p} />}
                  <RecordActions
                    kind="pre_damage"
                    id={p.id}
                    deleted={!!p.deletedAt}
                  />
                </div>

                <HistoryList entries={history} names={names} />
              </article>
            );
          })}
        </div>
      </Section>

      {/* Offloads: where the goods were offloaded */}
      <Section
        title="Offload"
        icon={PackageCheck}
        count={(job.offloads ?? []).length}
      >
        <div className="space-y-4">
          {(job.offloads ?? []).map((o) => (
            <OffloadCard
              key={o.id}
              offload={o}
              byName={names[o.createdBy ?? ""]}
            >
              <OffloadAdmin
                offload={o}
                carriers={carrierOptions.map((c) => ({
                  id: c.id,
                  name: c.name,
                }))}
              />
              <HistoryList entries={historyFor(o.id)} names={names} />
            </OffloadCard>
          ))}
        </div>
      </Section>

      {/* Photos and signed paperwork uploaded after the fact */}
      <Section
        title="Documents"
        icon={FileText}
        count={documents.filter((d) => !d.deletedAt).length}
        alwaysShow
      >
        <JobDocuments jobId={job.id} documents={documents} names={names} />
      </Section>

      {/* Damage incidents */}
      <Section
        title="Damage incidents"
        icon={AlertTriangle}
        count={job.damages.length}
        action={
          <Link
            href={`/admin/jobs/${job.id}/damage/new`}
            className="flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-semibold transition hover:border-foreground/30"
          >
            <Plus className="h-4 w-4" /> Add damage
          </Link>
        }
      >
        <div className="space-y-4">
          {job.damages.map((d) => (
            <article
              key={d.id}
              className={cn(
                "rounded-xl border p-4",
                d.deletedAt && "border-dashed opacity-60",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{d.item}</p>
                  {d.damageDate && (
                    <p className="text-sm text-muted-foreground">
                      Damage date: {formatDate(d.damageDate)}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {d.attributedTo && (
                    <Pill tone="primary">
                      <Headset className="h-3 w-3" /> Reported by customer
                      service
                    </Pill>
                  )}
                  {d.source && d.source !== "driver" && (
                    <Pill tone="primary">{DAMAGE_SOURCE_LABELS[d.source]}</Pill>
                  )}
                  <Pill tone={d.claimFiled ? "danger" : "neutral"}>
                    {d.claimFiled ? "Claim filed" : "No claim"}
                  </Pill>
                  <Pill>{formatCurrency(d.estimatedCost)}</Pill>
                  <DeletedPill at={d.deletedAt} />
                </div>
              </div>
              <p className="mt-2 text-[15px]">{d.description}</p>
              {d.attributedTo && (
                <div className="mt-3 grid gap-1 rounded-lg bg-sky-50 px-3 py-2.5 text-sm text-sky-950 sm:grid-cols-2">
                  <p>
                    <span className="text-sky-900/70">Attributed to: </span>
                    <b>
                      {DAMAGE_ATTRIBUTION_LABELS[d.attributedTo]}
                      {" · "}
                      {d.attributedTo === "carrier"
                        ? (carriers.find((c) => c.id === d.carrierId)
                            ?.companyName ?? "Carrier")
                        : (names[d.attributedDriverId ?? ""] ?? "Driver")}
                    </b>
                  </p>
                  <p>
                    <span className="text-sky-900/70">Reported: </span>
                    {d.reportedOn ? formatDate(d.reportedOn) : "—"}
                    {" by "}
                    {names[d.reportedBy ?? ""] ?? "admin"}
                  </p>
                </div>
              )}
              {d.photos.length > 0 && (
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                  {d.photos.map((src, i) => (
                    <PhotoThumb
                      key={src + i}
                      src={src}
                      alt={`${d.item} photo ${i + 1}`}
                    />
                  ))}
                </div>
              )}

              {(d.notes ?? []).length > 0 && (
                <ol className="mt-4 space-y-3 rounded-lg bg-muted/50 p-3">
                  {(d.notes ?? []).map((n) => (
                    <li key={n.id} className="text-sm">
                      <p className="flex flex-wrap items-center gap-1.5 font-semibold">
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                        {names[n.createdBy ?? ""] ?? "Admin"}
                        <span className="font-normal text-muted-foreground">
                          · {formatDateTimeET(n.createdAt)}
                        </span>
                      </p>
                      <p className="mt-0.5 whitespace-pre-line">{n.note}</p>
                      {n.photos.length > 0 && (
                        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                          {n.photos.map((src, i) => (
                            <PhotoThumb
                              key={src + i}
                              src={src}
                              alt={`Note photo ${i + 1}`}
                            />
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              )}

              <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
                <p className="pt-2 text-xs text-muted-foreground">
                  {d.source && d.source !== "driver" ? "Entered" : "Reported"}{" "}
                  by {names[d.createdBy ?? ""] ?? "Unknown"} ·{" "}
                  {formatDateTimeET(d.createdAt)}
                  {job.deliveredBy === "partner" &&
                    !d.attributedTo &&
                    " · Partner delivery, not counted in damage rate"}
                </p>
                <div className="flex flex-wrap items-start justify-end gap-2">
                  {!d.deletedAt && (
                    <DamageNoteForm damageId={d.id} jobId={job.id} />
                  )}
                  {!d.deletedAt && <DamageCorrection record={d} />}
                  <RecordActions
                    kind="damage"
                    id={d.id}
                    deleted={!!d.deletedAt}
                  />
                </div>
              </div>

              <HistoryList entries={historyFor(d.id)} names={names} />
            </article>
          ))}
        </div>
      </Section>

      {/* Reviews */}
      <Section
        title="Reviews"
        icon={Star}
        count={job.reviews.length}
        action={
          <Link
            href={`/admin/jobs/${job.id}/review/new`}
            className="flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-semibold transition hover:border-foreground/30"
          >
            <Plus className="h-4 w-4" /> Add review
          </Link>
        }
      >
        <div className="divide-y">
          {job.reviews.map((r) => (
            <div
              key={r.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0",
                r.deletedAt && "opacity-60",
              )}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">
                    {REVIEW_PLATFORM_LABELS[r.platform]}
                  </p>
                  {r.repId && (
                    <Pill tone="primary">
                      Sales rep: {names[r.repId] ?? "Rep"}
                    </Pill>
                  )}
                  {r.countsForDriver === false && (
                    <Pill tone="neutral">Not counted for driver</Pill>
                  )}
                  {r.addedByAdmin && <Pill tone="neutral">Added by admin</Pill>}
                  <DeletedPill at={r.deletedAt} />
                </div>
                {r.reason && (
                  <p className="mt-1 text-sm">
                    <span className="text-muted-foreground">Reason: </span>
                    {r.reason}
                  </p>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <Stars value={r.stars} />
                  <span>
                    {r.driverMentioned ? "Driver named" : "Driver not named"}
                  </span>
                  {r.link && (
                    <a
                      href={r.link}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      Link
                    </a>
                  )}
                  {r.screenshotUrl && (
                    <a
                      href={r.screenshotUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-primary hover:underline"
                    >
                      Screenshot
                    </a>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!r.deletedAt && (
                  <ReviewAttribution
                    review={r}
                    reps={repOptions}
                    driverName={names[job.driverId] ?? "driver"}
                    suggestedRepId={suggestedRepId}
                  />
                )}
                {!r.deletedAt && (
                  <VerifyToggle kind="review" id={r.id} verified={r.verified} />
                )}
                <RecordActions
                  kind="review"
                  id={r.id}
                  deleted={!!r.deletedAt}
                />
              </div>
              {historyFor(r.id).length > 0 && (
                <div className="basis-full">
                  <HistoryList entries={historyFor(r.id)} names={names} />
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* Upsells */}
      <Section title="Upsells" icon={DollarSign} count={job.upsells.length}>
        <div className="divide-y">
          {job.upsells.map((u) => (
            <div
              key={u.id}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0",
                u.deletedAt && "opacity-60",
              )}
            >
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <p className="font-semibold">{UPSELL_TYPE_LABELS[u.type]}</p>
                <p className="font-heading text-lg font-bold">
                  {formatCurrency(u.amount)}
                </p>
                <DeletedPill at={u.deletedAt} />
              </div>
              <div className="flex items-center gap-2">
                {!u.deletedAt && (
                  <VerifyToggle kind="upsell" id={u.id} verified={u.verified} />
                )}
                <RecordActions
                  kind="upsell"
                  id={u.id}
                  deleted={!!u.deletedAt}
                />
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
