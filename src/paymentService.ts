import ComgateClient from "comgate-node";

/**
 * Payment service pro Tesla pronájem.
 *
 * Comgate v jedné integraci pokrývá vše, co zákazník očekává na výběr:
 * - platební karty
 * - Google Pay / Apple Pay
 * - "bankovní tlačítka" (přímé přihlášení do internetového bankovnictví)
 *   pro většinu českých bank (ČSOB, KB, Fio, Raiffeisenbank, Moneta, Air Bank, ...)
 *
 * Nemusíme tedy integrovat každou banku zvlášť - Comgate má endpoint `methods`,
 * který vrátí seznam aktuálně dostupných metod/bank pro danou zemi a měnu.
 * Frontend jen vykreslí tlačítka podle toho, co endpoint vrátí.
 */

const comgateClient = new ComgateClient({
  merchant: Number(process.env.COMGATE_MERCHANT_ID),
  secret: process.env.COMGATE_SECRET as string,
  test: process.env.COMGATE_TEST === "true",
});

export interface PaymentMethod {
  id: string; // e.g. "CARD_CZ_CSOB", "GPAY", "BANK_CS"
  name: string;
  logoUrl?: string;
}

/** Vrátí zákazníkovi aktuální seznam metod (karty, Google Pay, konkrétní banky). */
export async function listAvailablePaymentMethods(): Promise<PaymentMethod[]> {
  const response = await comgateClient.methods({
    curr: "CZK",
    country: "CZ",
  });
  return response.methods.map((m: any) => ({
    id: m.id,
    name: m.name,
    logoUrl: m.logo,
  }));
}

/**
 * Vytvoří platbu zálohy (běžná platba - peníze se rovnou strhnou).
 * `method` je id vybrané zákazníkem z listAvailablePaymentMethods(), nebo "ALL"
 * pokud chcete nechat výběr metody přímo na bráně Comgate.
 *
 * `refId` (= reservationId) se vrátí Comgate webhookem zpět, takže podle něj
 * webhook handler najde správnou rezervaci v databázi (viz routes/payment.ts).
 */
export async function createDepositPayment(params: {
  reservationId: string;
  amountCzk: number;
  customerEmail: string;
  method?: string;
}) {
  const response = await comgateClient.create({
    country: "CZ",
    curr: "CZK",
    price: Math.round(params.amountCzk * 100), // Comgate pracuje v haléřích
    label: `Zaloha - rezervace ${params.reservationId}`,
    refId: params.reservationId,
    method: params.method ?? "ALL",
    email: params.customerEmail,
    lang: "cs",
    prepareOnly: false,
  });
  // response.redirect - kam přesměrovat zákazníka k dokončení platby
  // response.transId - Comgate transaction id, uložit k rezervaci
  return response;
}

/**
 * Vytvoří kauci jako PRE-AUTH (peníze se na kartě jen zablokují, nestrhnou).
 * Funguje pouze pro platby kartou / Google Pay / Apple Pay (bankovní tlačítka
 * pre-auth nepodporují - o tom viz poznámka níže).
 */
export async function createDepositHold(params: {
  reservationId: string;
  depositCzk: number;
  customerEmail: string;
}) {
  const response = await comgateClient.create({
    country: "CZ",
    curr: "CZK",
    price: Math.round(params.depositCzk * 100),
    label: `Kauce (blokace) - rezervace ${params.reservationId}`,
    refId: `${params.reservationId}-DEPOSIT`,
    // Omezit metody jen na ty, které pre-auth podporují (karty + wallets)
    method: "CARD_ALL",
    email: params.customerEmail,
    lang: "cs",
    prepareOnly: false,
    // preauth se řídí konfigurací merchanta v Comgate administraci
    // (nastavuje se tarif/metoda jako "preauth" tam, ne per-request flag)
  });
  return response;
}

/** Po vrácení vozu bez škody: kauce se NEstrhne, jen se zruší blokace. */
export async function releaseDepositHold(comgateTransId: string) {
  return comgateClient.cancelPreauth({ transId: comgateTransId });
}

/** Po vrácení vozu se škodou/pokutou: reálně strhne část nebo celou kauci. */
export async function captureDepositHold(params: {
  comgateTransId: string;
  amountCzk: number;
}) {
  return comgateClient.capturePreauth({
    transId: params.comgateTransId,
    amount: Math.round(params.amountCzk * 100),
    curr: "CZK",
  });
}

/** Zjištění aktuálního stavu platby/kauce (pro polling nebo dashboard). */
export async function getPaymentStatus(comgateTransId: string) {
  return comgateClient.status({ transId: comgateTransId });
}
