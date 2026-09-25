/**
 * Vytváření a rušení dočasného přístupu k Tesle.
 *
 * DŮLEŽITÁ POZNÁMKA: FleetBold ani obdobné "car-sharing" platformy nemají
 * (na rozdíl od Comgate) jedno stabilní, veřejně zdokumentované REST API,
 * jehož tvar bych mohl ověřit - u nich se obvykle domlouvá partnerský
 * přístup/API klíč přímo s poskytovatelem. Níže je proto DESIGN, který
 * odpovídá tomu, jak tyhle služby v praxi fungují (viz README), ale
 * konkrétní URL/pole endpointu si ověřte v partnerské dokumentaci, kterou
 * vám pošlou po registraci - je to jediné místo v celém projektu, kde
 * musíte tvar requestu doladit sami podle skutečné smlouvy/API klíče.
 *
 * Pokud byste místo toho chtěli jít přímo přes oficiální Tesla Fleet API
 * (vlastní Virtual Key, vlastní middleware), tahle vrstva se nemění -
 * jen se přepíše implementace uvnitř, veřejné funkce (createVehicleAccess /
 * revokeVehicleAccess) zůstanou stejné a zbytek appky se nedotkne.
 */

const PROVIDER_BASE_URL = process.env.VEHICLE_ACCESS_API_URL as string; // např. FleetBold partner API
const PROVIDER_API_KEY = process.env.VEHICLE_ACCESS_API_KEY as string;

export interface VehicleAccessResult {
  accessId: string; // ID pozvánky/klíče u poskytovatele - ukládá se do Reservation.vehicleAccessId
  unlockUrl?: string; // pokud poskytovatel vrací přímý odkaz pro appku/tlačítko "Odemknout"
}

/**
 * Vytvoří dočasný přístup k vozu, platný přesně pro okno rezervace.
 * Idempotentní na úrovni volajícího kódu: webhook handler tuhle funkci
 * volá jen pokud `Reservation.vehicleAccessId` ještě není vyplněné.
 */
export async function createVehicleAccess(params: {
  vehicleVin: string;
  customerEmail: string;
  customerPhone: string;
  startsAt: Date;
  endsAt: Date;
}): Promise<VehicleAccessResult> {
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

/** Zruší přístup ihned po vrácení vozu (nebo při zrušení rezervace). */
export async function revokeVehicleAccess(accessId: string): Promise<void> {
  const response = await fetch(`${PROVIDER_BASE_URL}/v1/guest-keys/${accessId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${PROVIDER_API_KEY}` },
  });
  if (!response.ok && response.status !== 404) {
    const body = await response.text();
    throw new Error(`Vehicle access revoke error ${response.status}: ${body}`);
  }
}
