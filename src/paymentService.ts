/**
 * Payment service — Comgate + MOCK_MODE.
 *
 * MOCK_MODE=true (výchozí bez reálných klíčů): žádné volání Comgate,
 * platby se simulují lokálně. Webhook se volá interně po create.
 * Po registraci u Comgate nastavte MOCK_MODE=false + merchant/secret.
 */

const MOCK = process.env.MOCK_MODE === "true" || !process.env.COMGATE_SECRET || process.env.COMGATE_SECRET === "change-me";

export interface PaymentMethod {
  id: string;
  name: string;
  logoUrl?: string;
}

function mockTransId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

let comgateClient: any = null;
if (!MOCK) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ComgateClient = require("comgate-node").default;
  comgateClient = new ComgateClient({
    merchant: Number(process.env.COMGATE_MERCHANT_ID),
    secret: process.env.COMGATE_SECRET as string,
    test: process.env.COMGATE_TEST === "true",
  });
}

export async function listAvailablePaymentMethods(): Promise<PaymentMethod[]> {
  if (MOCK) {
    return [
      { id: "CARD_ALL", name: "Platební karta (MOCK)" },
      { id: "GPAY", name: "Google Pay (MOCK)" },
      { id: "BANK_CS", name: "Česká spořitelna (MOCK)" },
      { id: "BANK_FIO", name: "Fio banka (MOCK)" },
    ];
  }
  const response = await comgateClient.methods({ curr: "CZK", country: "CZ" });
  return response.methods.map((m: any) => ({
    id: m.id,
    name: m.name,
    logoUrl: m.logo,
  }));
}

export async function createDepositPayment(params: {
  reservationId: string;
  amountCzk: number;
  customerEmail: string;
  method?: string;
}) {
  if (MOCK) {
    const transId = mockTransId("DEP");
    console.log(`[MOCK] deposit ${params.amountCzk} Kč, transId=${transId}`);
    // Simulace webhooku za 1,5 s — frontend stihne pollovat
    setTimeout(() => {
      fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/payment/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transId, refId: params.reservationId }),
      }).catch((e) => console.warn("[MOCK] webhook deposit failed", e.message));
    }, 1500);
    return { transId, redirect: null, code: 0 };
  }
  return comgateClient.create({
    country: "CZ",
    curr: "CZK",
    price: Math.round(params.amountCzk * 100),
    label: `Zaloha - rezervace ${params.reservationId}`,
    refId: params.reservationId,
    method: params.method ?? "ALL",
    email: params.customerEmail,
    lang: "cs",
    prepareOnly: false,
  });
}

export async function createDepositHold(params: {
  reservationId: string;
  depositCzk: number;
  customerEmail: string;
}) {
  if (MOCK) {
    const transId = mockTransId("KAU");
    console.log(`[MOCK] kauce hold ${params.depositCzk} Kč, transId=${transId}`);
    setTimeout(() => {
      fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/payment/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transId, refId: params.reservationId }),
      }).catch((e) => console.warn("[MOCK] webhook kauce failed", e.message));
    }, 2000);
    return { transId, redirect: null, code: 0 };
  }
  return comgateClient.create({
    country: "CZ",
    curr: "CZK",
    price: Math.round(params.depositCzk * 100),
    label: `Kauce (blokace) - rezervace ${params.reservationId}`,
    refId: `${params.reservationId}-DEPOSIT`,
    method: "CARD_ALL",
    email: params.customerEmail,
    lang: "cs",
    prepareOnly: false,
  });
}

export async function releaseDepositHold(comgateTransId: string) {
  if (MOCK) {
    console.log(`[MOCK] release kauce ${comgateTransId}`);
    return { code: 0 };
  }
  return comgateClient.cancelPreauth({ transId: comgateTransId });
}

export async function captureDepositHold(params: {
  comgateTransId: string;
  amountCzk: number;
}) {
  if (MOCK) {
    console.log(`[MOCK] capture kauce ${params.comgateTransId} amount=${params.amountCzk}`);
    return { code: 0 };
  }
  return comgateClient.capturePreauth({
    transId: params.comgateTransId,
    amount: Math.round(params.amountCzk * 100),
    curr: "CZK",
  });
}

export async function getPaymentStatus(comgateTransId: string) {
  if (MOCK) {
    // V mocku jsou všechny známé transId ihned PAID/AUTHORIZED
    return { status: comgateTransId.startsWith("KAU") ? "AUTHORIZED" : "PAID", transId: comgateTransId };
  }
  return comgateClient.status({ transId: comgateTransId });
}
