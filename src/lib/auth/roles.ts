// File: src/lib/auth/roles.ts
// (REPLACE the whole file)

import type { Role } from "@/types";

export function homeFor(role: Role) {
  if (role === "admin") return "/admin";
  if (role === "driver") return "/driver";
  if (role === "carrier") return "/carrier";
  return "/sales";
}

export const ROUTE_ROLES: { prefix: string; role: Role }[] = [
  { prefix: "/admin", role: "admin" },
  { prefix: "/driver", role: "driver" },
  { prefix: "/sales", role: "sales_rep" },
  { prefix: "/carrier", role: "carrier" },
];

/** "/driver" matches "/driver" and "/driver/..." but not "/driver-offline" */
export function matchRoute(pathname: string) {
  return ROUTE_ROLES.find(
    (r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"),
  );
}
