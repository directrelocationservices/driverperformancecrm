// File: src/lib/services/geocode.ts
// (NEW file)

/*
 * Turns GPS into a street address (OpenStreetMap Nominatim, free).
 * Optional: set GEOCODE_URL to use another Nominatim-compatible service.
 * Never throws: returns null if the lookup fails.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<string | null> {
  const base = (
    process.env.GEOCODE_URL || "https://nominatim.openstreetmap.org"
  ).replace(/\/+$/, "");
  try {
    const res = await fetch(
      `${base}/reverse?format=jsonv2&zoom=18&addressdetails=0&lat=${lat}&lon=${lng}`,
      {
        headers: {
          "User-Agent": "DRS-Performance-Portal/1.0 (offload records)",
          "Accept-Language": "en-US",
        },
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { display_name?: string };
    return data.display_name?.trim() || null;
  } catch {
    return null;
  }
}
