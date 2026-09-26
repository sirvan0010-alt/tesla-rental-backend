/**
 * Přístup k vozu — FleetBold (návrh) + MOCK_MODE.
 *
 * MOCK_MODE=true: žádné HTTP volání, vrací fiktivní accessId a unlock URL.
 * Po registraci u FleetBold nastavte MOCK_MODE=false a upravte URL/pole
 * podle jejich partnerské dokumentace — veřejné funkce zůstanou stejné.
 */

const MOCK =
  process.env.MOCK_MODE === "true" ||
  !process.env.VEHICLE_ACCESS_API_KEY ||
  process.env.VEHICLE_ACCESS_API_KEY === "change-me";

const PROVIDER_BASE_URL = process.env.VEHICLE_ACCESS_API_URL as string;
const PROVIDER_API_KEY = process.env.VEHICLE_ACCESS_API_KEY as string;

export interface VehicleAccessResult {
  accessId: string;
  unlockUrl?: string;
}

export async function createVehicleAccess(params: {
  vehicleVin: string;
  customerEmail: string;
  customerPhone: string;
  startsAt: Date;
  endsAt: Date;
}): Promise<VehicleAccessResult> {
  if (MOCK) {
    const accessId = `mock-access-${params.vehicleVin}-${Date.now()}`;
    console.log(`[MOCK] createVehicleAccess vin=${params.vehicleVin} accessId=${accessId}`);
    return {
      accessId,
      unlockUrl: `https://example.invalid/unlock/${accessId}`,
    };
  }

  const response = await fetch(`${PROVIDER_BASE_URL}/v1/guest-keys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${PROVIDER_API_KEY}`,
    },
    body: JSON.stringify({
      vin: params.vehicleVin,
      guest_email: params.customerEmail,
      guest_phone: params.customerPhone,
      access_start: params.startsAt.toISOString(),
      access_end: params.endsAt.toISOString(),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Vehicle access provider error ${response.status}: ${body}`);
  }

  const data = await response.json();
  return { accessId: data.id, unlockUrl: data.unlock_url };
}

export async function revokeVehicleAccess(accessId: string): Promise<void> {
  if (MOCK) {
    console.log(`[MOCK] revokeVehicleAccess ${accessId}`);
    return;
  }
  const response = await fetch(`${PROVIDER_BASE_URL}/v1/guest-keys/${accessId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${PROVIDER_API_KEY}` },
  });
  if (!response.ok && response.status !== 404) {
    const body = await response.text();
    throw new Error(`Vehicle access revoke error ${response.status}: ${body}`);
  }
}
