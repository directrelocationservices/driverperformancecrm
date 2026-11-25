// File: src/types/index.ts
// (REPLACE the whole file)

export type Role = "admin" | "driver" | "sales_rep" | "carrier";

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  active: boolean;
  avatarUrl?: string;
  /** Must set a new password before using the portal */
  mustChangePassword?: boolean;
}

export type DeliveredBy = "drs" | "partner";

export interface Job {
  id: string;
  jobNumber: string;
  date: string; // YYYY-MM-DD
  originCity: string;
  originState: string;
  destCity: string;
  destState: string;
  driverId: string;
  crewIds: string[];
  deliveredBy: DeliveredBy;
  onTimePickup: boolean | null;
  onTimeDelivery: boolean | null;
  createdAt: string;
  /** Carrier that delivered a "Partner" job */
  carrierId?: string | null;
  customerName?: string | null;
  /** YYYY-MM-DD */
  deliveryDate?: string | null;
  /** Admin who logged the job for the driver (null = the driver did) */
  enteredBy?: string | null;
}

export interface PreDamage {
  id: string;
  jobId: string;
  item: string;
  description: string;
  location: string;
  photos: string[];
  customerShown: boolean;
  customerName: string;
  signatureUrl: string | null;
  notes?: string;
  /** Null for office-entered records (no device on site) */
  capturedAtDevice: string | null;
  receivedAtServer: string;
  syncedOffline: boolean;
  lat: number | null;
  lng: number | null;
  locked: boolean;
  deletedAt?: string | null;
  /** Photos the office uploaded later (not captured on site) */
  officeEntered?: boolean;
  createdBy?: string | null;
}

/** Photos / signed paperwork uploaded to a job after the fact */
export type JobDocumentKind = "photo" | "paperwork" | "other";
export interface JobDocument {
  id: string;
  kind: JobDocumentKind;
  name: string;
  url: string;
  isPdf: boolean;
  uploadedBy: string | null;
  createdAt: string;
  deletedAt: string | null;
}

export type DamageSource =
  "driver" | "customer_call" | "claim" | "inspection" | "other";

export const DAMAGE_SOURCE_LABELS: Record<DamageSource, string> = {
  driver: "Driver report",
  customer_call: "Customer call",
  claim: "Claim",
  inspection: "Inspection",
  other: "Other",
};

/** Admin note on a damage incident (admins only) */
export interface DamageNote {
  id: string;
  note: string;
  photos: string[];
  createdBy: string | null;
  createdAt: string;
}

export interface DamageIncident {
  id: string;
  jobId: string;
  item: string;
  description: string;
  photos: string[];
  claimFiled: boolean;
  estimatedCost: number;
  createdAt: string;
  deletedAt?: string | null;
  /** Day the damage happened (admin entries); null for older driver reports */
  damageDate?: string | null;
  source?: DamageSource;
  createdBy?: string | null;
  notes?: DamageNote[];
  /** Customer service report (admins): when and who took it */
  reportedOn?: string | null;
  reportedBy?: string | null;
  /** Who it counts against; null = the job's driver (driver-logged) */
  attributedTo?: DamageAttribution | null;
  attributedDriverId?: string | null;
  carrierId?: string | null;
}

export type DamageAttribution = "pickup" | "delivery" | "carrier";

export const DAMAGE_ATTRIBUTION_LABELS: Record<DamageAttribution, string> = {
  pickup: "Pickup crew",
  delivery: "Delivery crew",
  carrier: "Partner carrier",
};

export type ReviewPlatform =
  "google" | "bbb" | "trustpilot" | "facebook" | "other";

export interface Review {
  id: string;
  jobId: string;
  platform: ReviewPlatform;
  stars: number;
  driverMentioned: boolean;
  link?: string;
  screenshotUrl?: string;
  verified: boolean;
  createdAt: string;
  deletedAt?: string | null;
  /** Sales rep the review is about (admins set this) */
  repId?: string | null;
  /** Counts in the driver's review stats */
  countsForDriver?: boolean;
  /** Short reason, e.g. "price change" */
  reason?: string | null;
  /** YYYY-MM-DD */
  reviewDate?: string | null;
  addedByAdmin?: boolean;
  createdBy?: string | null;
}

/** 4–5 stars = positive, 1–2 stars = negative (3 = neutral) */
export const reviewTone = (stars: number) =>
  stars >= 4 ? "positive" : stars <= 2 ? "negative" : "neutral";

export type UpsellType = "packing" | "storage" | "materials" | "other";

export interface Upsell {
  id: string;
  jobId: string;
  type: UpsellType;
  amount: number;
  verified: boolean;
  createdAt: string;
  deletedAt?: string | null;
}

export interface JobDetail extends Job {
  preDamages: PreDamage[];
  damages: DamageIncident[];
  reviews: Review[];
  upsells: Upsell[];
  documents?: JobDocument[];
  offloads?: Offload[];
}

/* ---------- Offload ---------- */
export type OffloadDestination =
  "customer" | "warehouse" | "storage" | "carrier" | "other";

export const OFFLOAD_DESTINATION_LABELS: Record<OffloadDestination, string> = {
  customer: "Customer delivery",
  warehouse: "Our warehouse",
  storage: "Storage unit",
  carrier: "Partner carrier handoff",
  other: "Other",
};

/** A form drivers upload at offload (edited in Admin → Settings) */
export interface OffloadForm {
  id: string;
  name: string;
  required: boolean;
  active: boolean;
  sort: number;
}

export interface OffloadFormPages {
  formId: string;
  name: string;
  required: boolean;
  /** Storage paths of the pages (photos or PDFs) */
  pages: string[];
}

export interface OffloadPage {
  path: string;
  url: string;
  isPdf: boolean;
}

export interface Offload {
  id: string;
  jobId: string;
  destination: OffloadDestination;
  storageFacility?: string;
  storageAddress?: string;
  storageUnit?: string;
  carrierId?: string;
  carrierName?: string;
  note?: string;
  photos: string[];
  forms: (OffloadFormPages & { files: OffloadPage[] })[];
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  address?: string;
  capturedAtDevice: string;
  receivedAtServer: string;
  syncedOffline: boolean;
  locked: boolean;
  createdBy?: string;
  deletedAt?: string;
}

export interface DriverMetrics {
  driverId: string;
  driverName: string;
  jobs: number;
  damageCount: number;
  damagedJobs: number; // jobs with at least one damage
  damageCost: number;
  damageRate: number; // damagedJobs / jobs
  reviewCount: number;
  avgStars: number;
  fiveStarRate: number;
  upsellTotal: number;
  upsellAvg: number;
  onTimePickupRate: number | null;
  onTimeDeliveryRate: number | null;
}

/** Rep row for leads whose Granot rep isn't linked to a portal account yet */
export const UNMATCHED_REP_ID = "unmatched";

/** Rep row for leads that have no sales rep in Granot at all */
export const UNASSIGNED_REP_ID = "unassigned";

export interface RepMetrics {
  repId: string;
  repName: string;
  /** "admin": an admin's own Granot leads (in totals, not in the rep comparison) */
  kind?: "admin";
  leads: number;
  booked: number;
  closingRatio: number;
  totalLeadCost: number;
  cpa: number;
  revenue: number;
  /** Reviews attributed to the rep (4–5 stars / 1–2 stars) */
  positiveReviews?: number;
  negativeReviews?: number;
  /** Per booked job */
  positivePerBooked?: number;
  negativePerBooked?: number;
}

export interface DateRange {
  from?: string;
  to?: string;
}

export interface SalesMonthlyPoint {
  month: string;
  leads: number;
  booked: number;
  closingRatio: number; // percent 0-100
  cpa: number;
  revenue: number;
}

export const REVIEW_PLATFORM_LABELS: Record<ReviewPlatform, string> = {
  google: "Google",
  bbb: "BBB",
  trustpilot: "Trustpilot",
  facebook: "Facebook",
  other: "Other",
};

export const UPSELL_TYPE_LABELS: Record<UpsellType, string> = {
  packing: "Packing",
  storage: "Storage",
  materials: "Materials",
  other: "Other",
};

export interface JobSummary extends Job {
  preDamageCount: number;
  damageCount: number;
  reviewCount: number;
  upsellTotal: number;
}

export interface MonthlyPoint {
  month: string;
  jobs: number;
  upsells: number;
  damageRate: number; // percent 0-100
  avgStars: number;
}

export type RecordKind = "pre_damage" | "damage" | "review" | "upsell";
export type EntityType =
  RecordKind | "job" | "carrier_claim" | "document" | "offload";
export type AuditAction =
  "create" | "update" | "delete" | "restore" | "verify" | "unverify";

export interface AuditEntry {
  id: string;
  entityType: EntityType;
  entityId: string;
  jobId: string;
  action: AuditAction;
  changedBy: string; // user id
  changedAt: string; // server time
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason?: string;
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  driver: "Driver",
  sales_rep: "Sales Rep",
  carrier: "Carrier",
};

export interface CompanyInfo {
  name: string;
  usdot: string;
  mc: string;
  address: string;
  phone: string;
  email: string;
}

export interface AppSettings {
  company: CompanyInfo;
  damageAlertEmails: string[];
  /** Offload alerts (empty = the damage alert emails) */
  offloadAlertEmails?: string[];
  scoring: ScoringSettings;
}

export type LeadStatus = "open" | "booked";

export interface LeadSourceRow {
  id: string;
  /** Shown everywhere in the app; should match the source name in Granot */
  name: string;
  active: boolean;
  createdAt: string;
}

export interface Lead {
  id: string;
  granotId: string;
  date: string; // YYYY-MM-DD
  repId: string;
  sourceId: string;
  leadCost: number;
  costOverridden: boolean;
  status: LeadStatus;
  bookedDate: string | null;
  jobValue: number | null;
  /** Sample lead for review (removed before Granot goes live) */
  isSample?: boolean;
  /** Sales rep username as sent by Granot (kept even when not linked) */
  granotRep?: string | null;
}

export interface LeadCost {
  id: string;
  sourceId: string;
  /** Monday of the week, YYYY-MM-DD */
  week: string;
  cost: number;
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  open: "Open",
  booked: "Booked",
};

export interface SourceBreakdownRow {
  sourceId: string;
  sourceName: string;
  leads: number;
  booked: number;
  closingRatio: number;
  totalLeadCost: number;
  cpa: number;
  revenue: number;
}

/* ---------- Fleet ---------- */
export type TruckStatus = "safe" | "repair_soon" | "do_not_drive";

export const TRUCK_STATUS_LABELS: Record<TruckStatus, string> = {
  safe: "Safe to drive",
  repair_soon: "Needs repair soon",
  do_not_drive: "Do not drive",
};

export interface Truck {
  id: string;
  unitNumber: string;
  description?: string;
  plate?: string;
  active: boolean;
  status: TruckStatus;
  odometer: number | null;
  lastInspectionAt: string | null;
  assignedDriverId: string | null;
  lastWashedAt: string | null;
  createdAt: string;
}

/** The 5 required truck condition photos taken on every pre-trip */
export type ConditionPhotoKey =
  "front" | "rear" | "driver_side" | "passenger_side" | "cab";

export const CONDITION_PHOTOS: { key: ConditionPhotoKey; label: string }[] = [
  { key: "front", label: "Front" },
  { key: "rear", label: "Rear" },
  { key: "driver_side", label: "Driver side" },
  { key: "passenger_side", label: "Passenger side" },
  { key: "cab", label: "Cab interior" },
];

export interface TruckWash {
  id: string;
  truckId: string;
  driverId: string;
  photoUrl: string;
  receiptUrl: string | null;
  notes?: string;
  capturedAtDevice: string;
  receivedAtServer: string;
  syncedOffline: boolean;
}

export interface WashOverdueEvent {
  id: string;
  truckId: string;
  driverId: string | null;
  since: string;
  dueDate: string;
}

/** Wash status of a truck, worked out from its last wash and the interval setting */
export interface WashStatus {
  lastWashedAt: string | null;
  dueDate: string; // YYYY-MM-DD
  overdue: boolean;
  daysLeft: number; // negative when overdue
}

/** Checklist item key (the daily items are set in Settings, so any text) */
export type CheckItemKey = string;
/** ok = "Yes", attention = "No" */
export type CheckStatus = "ok" | "attention";

/** One daily pre-trip item, as set in Admin → Settings */
export interface ChecklistItem {
  key: string;
  label: string;
  hint?: string;
  /** "No" holds the trip until an admin clears it */
  blocksTrip: boolean;
  /** "No" opens a maintenance ticket */
  ticket: boolean;
  /** "No" counts against the driver score */
  scored: boolean;
}

/** The roadside-ready daily items (used if Settings can't be read, and by "Reset") */
export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  {
    key: "logs",
    label: "Logs current, plus 8 days of blank paper log sheets",
    hint: "Logs are up to date and 8 days of blank paper log sheets are in the truck",
    blocksTrip: true,
    ticket: false,
    scored: true,
  },
  {
    key: "safety_kit",
    label: "Fire extinguisher charged and mounted, plus 3 warning triangles",
    hint: "Gauge in the green, mounted, and 3 triangles in the truck",
    blocksTrip: true,
    ticket: false,
    scored: true,
  },
  {
    key: "phone_mount",
    label: "Phone mounted in a fixed holder (the phone is the ELD)",
    hint: "In the holder, not loose on the seat or dash",
    blocksTrip: true,
    ticket: false,
    scored: true,
  },
  {
    key: "eld_connected",
    label: "ELD device plugged into the truck and connected",
    hint: "Plugged in, powered on and connected to the phone app",
    blocksTrip: true,
    ticket: false,
    scored: true,
  },
  {
    key: "no_prohibited",
    label: "No radar detector, no alcohol, and no unauthorized passengers",
    hint: "Nothing like this in the cab, and only approved riders",
    blocksTrip: true,
    ticket: false,
    scored: true,
  },
  {
    key: "shipping_papers",
    label: "Bill of lading and inventory for every shipment",
    hint: "And weight tickets when needed",
    blocksTrip: false,
    ticket: false,
    scored: true,
  },
  {
    key: "cab_secured",
    label: "Loose items in the cab secured",
    hint: "Nothing that can fly around in a hard stop",
    blocksTrip: false,
    ticket: false,
    scored: true,
  },
  {
    key: "brake_leaks",
    label: "Brakes: no leaks",
    hint: "No air or fluid leaks",
    blocksTrip: true,
    ticket: true,
    scored: false,
  },
  {
    key: "parking_brake",
    label: "Parking brake working",
    hint: "Holds the truck when set",
    blocksTrip: false,
    ticket: true,
    scored: false,
  },
  {
    key: "all_lights",
    label: "All lights working",
    hint: "Head, tail, brake, turn signals and markers",
    blocksTrip: false,
    ticket: true,
    scored: false,
  },
  {
    key: "plate_light",
    label: "License plate light working",
    hint: "The rear plate is lit",
    blocksTrip: false,
    ticket: true,
    scored: false,
  },
  {
    key: "tires_wheels",
    label: "Tires and wheels",
    hint: "Good tread, no damage, no loose or missing lug nuts",
    blocksTrip: true,
    ticket: true,
    scored: false,
  },
  {
    key: "cab_glass",
    label: "Windshield, wipers, mirrors, horn, seatbelt",
    hint: "No cracks, everything works",
    blocksTrip: false,
    ticket: true,
    scored: false,
  },
  {
    key: "fuel_leaks",
    label: "No fuel, oil or exhaust leaks",
    hint: "Under the truck and around the engine",
    blocksTrip: false,
    ticket: true,
    scored: false,
  },
  {
    key: "fuel_cap",
    label: "Fuel cap on",
    hint: "Closed and tight",
    blocksTrip: false,
    ticket: true,
    scored: false,
  },
  {
    key: "battery_steering",
    label: "Battery secured, and steering not loose",
    hint: "Battery tied down, and no extra play in the steering wheel",
    blocksTrip: false,
    ticket: true,
    scored: false,
  },
  {
    key: "license_plate",
    label: "License plate on and readable",
    hint: "Clean and easy to read",
    blocksTrip: false,
    ticket: true,
    scored: false,
  },
  {
    key: "load_doors",
    label: "Load secured, and doors latching",
    hint: "Straps and load bars in place, every door latches",
    blocksTrip: false,
    ticket: false,
    scored: true,
  },
];

/** The old 6 items (pre-trips saved before the roadside checklist) */
export const CHECK_ITEMS: { key: CheckItemKey; label: string; hint: string }[] =
  [
    {
      key: "tires",
      label: "Tires",
      hint: "Tread, pressure and sidewall damage",
    },
    {
      key: "fluids",
      label: "Oil / fluid leaks",
      hint: "Under the truck and around the engine",
    },
    {
      key: "lights",
      label: "Lights",
      hint: "Head, tail, brake and turn signals",
    },
    { key: "brakes", label: "Brakes", hint: "Pedal feel and air pressure" },
    {
      key: "mirrors",
      label: "Mirrors / glass",
      hint: "Cracks, chips and mirror position",
    },
    {
      key: "equipment",
      label: "Equipment",
      hint: "Blankets, dollies, straps and tools",
    },
  ];

export interface PreTripItem {
  key: CheckItemKey;
  /** Item name when it was checked (empty on old pre-trips) */
  label?: string;
  status: CheckStatus;
  notes?: string;
  photos: string[];
  /** "No" on this item held the trip */
  blocks?: boolean;
  /** "No" on this item counts against the driver */
  scored?: boolean;
}

/** A trip hold from a "No" on a blocking item */
export interface PreTripHold {
  blocked: boolean;
  clearedAt: string | null;
  clearedBy: string | null;
  clearNote: string | null;
}

export interface PreTripInspection {
  id: string;
  truckId: string;
  driverId: string;
  items: PreTripItem[];
  odometer: number;
  truckStatus: TruckStatus;
  notes?: string;
  signatureUrl: string;
  capturedAtDevice: string;
  receivedAtServer: string;
  lat: number | null;
  lng: number | null;
  syncedOffline: boolean;
  /** Signed links; empty for pre-trips saved before condition photos existed */
  conditionPhotos: Partial<Record<ConditionPhotoKey, string>>;
  /** "Has this truck been washed since the last trip?" */
  washed: boolean;
  washPhotoUrl: string | null;
  washReceiptUrl: string | null;
  hold: PreTripHold;
}

export type TicketStatus = "open" | "in_progress" | "fixed";

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  fixed: "Fixed",
};

export interface MaintenanceTicket {
  id: string;
  truckId: string;
  inspectionId: string;
  driverId: string;
  itemKey: CheckItemKey;
  /** Item name when the ticket was opened */
  itemLabel?: string;
  notes?: string;
  photos: string[];
  severity: TruckStatus;
  status: TicketStatus;
  fixNote?: string;
  /** YYYY-MM-DD, set when the ticket is fixed */
  fixedOn?: string;
  createdAt: string;
  updatedAt: string;
}

/** Ticket / check item name. "general" = truck marked Repair soon / Do not drive with no item flagged */
export const ticketItemLabel = (key: string, label?: string | null) =>
  label ||
  (key === "general"
    ? "Truck status"
    : (DEFAULT_CHECKLIST.find((c) => c.key === key)?.label ??
      CHECK_ITEMS.find((c) => c.key === key)?.label ??
      key));

export type RoadsideResult = "clean" | "violations" | "out_of_service";

export const ROADSIDE_RESULT_LABELS: Record<RoadsideResult, string> = {
  clean: "Clean",
  violations: "Violations",
  out_of_service: "Out of service",
};

export interface RoadsideInspection {
  id: string;
  driverId: string;
  truckId: string;
  date: string;
  state: string;
  location: string;
  result: RoadsideResult;
  violationNotes?: string;
  report: { name: string; type: "image" | "pdf"; url?: string } | null;
  loggedBy: string;
  createdAt: string;
}

export interface ScoringSettings {
  baseScore: number;
  clean: number;
  violations: number;
  outOfService: number;
  /** A truck is overdue when it hasn't been washed for this many days */
  washIntervalDays: number;
  /** Points for each overdue wash (0 or less) */
  overdueWash: number;
  /** Points for each pre-trip "No" on a scored item (0 or less). Default -2. */
  preTripNo?: number;
}

export interface ScoreLine {
  key: RoadsideResult | "overdue_wash" | "pre_trip_no";
  label: string;
  count: number;
  points: number;
  total: number;
}

export interface DriverScore {
  base: number;
  score: number;
  lines: ScoreLine[];
}

/* ---------- Roadside inspection readiness ---------- */
export type TruckDocType =
  | "registration"
  | "insurance"
  | "annual_inspection"
  | "eld_manual"
  | "eld_officer"
  | "eld_malfunction"
  | "other";
export type DriverDocType = "medical_card" | "license";
export type DocType = TruckDocType | DriverDocType;

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  registration: "Registration",
  insurance: "Proof of insurance",
  annual_inspection: "Annual DOT inspection report",
  eld_manual: "ELD user manual",
  eld_officer: "ELD: sending logs to an officer",
  eld_malfunction: "ELD malfunction instructions",
  other: "Other document",
  medical_card: "DOT medical card",
  license: "Driver's license",
};

export const TRUCK_DOC_TYPES: TruckDocType[] = [
  "registration",
  "insurance",
  "annual_inspection",
  "eld_manual",
  "eld_officer",
  "eld_malfunction",
  "other",
];
export const DRIVER_DOC_TYPES: DriverDocType[] = ["medical_card", "license"];

/** These need an expiry date; an expired one blocks the trip */
export const EXPIRING_DOC_TYPES: DocType[] = [
  "registration",
  "insurance",
  "annual_inspection",
  "medical_card",
  "license",
];

export interface DocFile {
  path: string;
  name: string;
  url: string;
  isPdf: boolean;
}

export interface FleetDocument {
  id: string;
  truckId: string | null;
  driverId: string | null;
  docType: DocType;
  /** Name of an "Other" document */
  title?: string;
  /** Driver documents: [front, back] */
  files: DocFile[];
  /** YYYY-MM-DD */
  expiresOn: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

export type ExpiryState = "ok" | "expiring" | "expired" | "missing";

/** One required document of a truck or driver and where it stands */
export interface DocStatus {
  docType: DocType;
  label: string;
  doc: FleetDocument | null;
  state: ExpiryState;
  /** Days until it expires (negative = days since) */
  days: number | null;
}

/** Why a driver can't start a trip right now */
export interface TripBlock {
  kind: "driver_doc" | "truck_doc" | "hold";
  message: string;
  /** Pre-trip with the hold (kind = "hold") */
  preTripId?: string;
}

export interface MonthlyCheckItemDef {
  key: string;
  label: string;
  hint: string;
}

/** The monthly truck check: 3 items, one photo each */
export const MONTHLY_CHECK_ITEMS: MonthlyCheckItemDef[] = [
  {
    key: "dot_markings",
    label: "Company name and USDOT number on both sides, readable",
    hint: "Check both doors. Letters must be clear and easy to read.",
  },
  {
    key: "mud_flaps",
    label: "Mud flaps in place and undamaged",
    hint: "Behind the rear wheels, on both sides.",
  },
  {
    key: "rear_guard",
    label: "Rear impact guard in place and undamaged",
    hint: "The bar under the back of the truck. No bends or cracks.",
  },
];

export interface MonthlyCheckItem {
  key: string;
  label: string;
  status: CheckStatus;
  notes?: string;
  photoUrl: string;
}

export interface MonthlyCheck {
  id: string;
  truckId: string;
  driverId: string;
  items: MonthlyCheckItem[];
  notes?: string;
  capturedAtDevice: string;
  receivedAtServer: string;
}

/* ---------- Carriers (partner companies) ---------- */
export interface Carrier {
  id: string;
  companyName: string;
  usdot: string | null;
  mcNumber: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  /** Private storage path of the insurance certificate */
  insurancePath: string | null;
  insuranceFileName: string | null;
  /** YYYY-MM-DD */
  insuranceExpires: string | null;
  notes: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ClaimStatus = "open" | "submitted" | "paid" | "closed";

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  open: "Open",
  submitted: "Submitted to carrier",
  paid: "Paid",
  closed: "Closed",
};

/** A file on a claim, with a short-lived link */
export interface ClaimFile {
  name: string;
  url: string;
  isPdf: boolean;
}

export interface CarrierClaimNote {
  id: string;
  note: string;
  files: ClaimFile[];
  internal: boolean;
  createdBy: string | null;
  createdAt: string;
}

/** Damage on a partner delivery, claimed against the carrier */
export interface CarrierClaim {
  id: string;
  carrierId: string;
  jobId: string;
  jobNumber: string;
  jobDate: string;
  item: string;
  description: string;
  claimAmount: number;
  paidAmount: number;
  chargedBackAmount: number;
  status: ClaimStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CarrierClaimDetail extends CarrierClaim {
  photos: string[];
  notes: CarrierClaimNote[];
  /** Pre-existing damage photos taken at pickup (the job's pre-damage records) */
  pickup: {
    item: string;
    location: string;
    description: string;
    photos: string[];
  }[];
}

export interface CarrierScore {
  carrierId: string;
  companyName: string;
  active: boolean;
  jobs: number;
  claims: number;
  jobsWithClaims: number;
  /** Share of jobs with at least one claim (0-1) */
  claimRate: number;
  claimed: number;
  paid: number;
  chargedBack: number;
  /** What the damage cost DRS: paid to customers minus charged back */
  netCost: number;
  openClaims: number;
  /** Damages customer service attributed to this carrier */
  damageReports: number;
}

/* ---------- Lead costs for a date range ---------- */
export type CostRangeMode = "per_lead" | "total";

export interface CostRange {
  id: string;
  sourceId: string;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
  mode: CostRangeMode;
  /** Cost per lead (per_lead) or total spend (total) */
  amount: number;
  /** What each lead in the range costs */
  costPerLead: number;
  leadCount: number;
  note: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

export interface CostRangeChange {
  id: string;
  rangeId: string;
  sourceId: string;
  action: "create" | "update" | "delete";
  before: Partial<{
    start_date: string;
    end_date: string;
    mode: CostRangeMode;
    amount: number;
    source_id: string;
  }> | null;
  after: Partial<{
    start_date: string;
    end_date: string;
    mode: CostRangeMode;
    amount: number;
    source_id: string;
    lead_count: number;
    cost_per_lead: number;
  }> | null;
  changedBy: string | null;
  changedAt: string;
}

/* ---------- Sales leaderboard ---------- */
export interface SalesSettings {
  /** Leads a rep needs before ranking on Close % */
  leaderboardMinLeads: number;
  /** Sales reps can see the leaderboard from their own login */
  repsSeeLeaderboard: boolean;
}

/**
 * How sales numbers are counted:
 *  "granot" (default): like Granot's Salesmen Performance report. Leads = Total In
 *    (leads that came in during the period), Booked = those leads now booked,
 *    Close % = Booked ÷ Total In, Revenue = jobs booked in the period (by booking date).
 *  "lead": everything by lead date (for lead source and CPA analysis).
 */
export type SalesView = "granot" | "lead";
