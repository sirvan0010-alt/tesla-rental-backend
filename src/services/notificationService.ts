/**
 * Zjednodušený stub pro odeslání instrukcí zákazníkovi po úspěšné platbě.
 * Nahraďte skutečnou integrací (SendGrid/Mailgun pro e-mail, Twilio/O2 SMS
 * Gateway pro SMS) - rozhraní (parametry funkce) zůstane stejné, takže
 * zbytek appky (webhook) se nemusí měnit.
 */
export async function sendAccessInstructions(params: {
  customerEmail: string;
  customerPhone: string;
  unlockUrl?: string;
  startsAt: Date;
  endsAt: Date;
}) {
  // TODO: nahradit skutečným voláním SendGrid/Mailgun + Twilio/O2
  console.log(
    `[notify] Poslat instrukce na ${params.customerEmail} / ${params.customerPhone}: ` +
      `odkaz ${params.unlockUrl ?? "(appka pošle vlastní deep-link)"}, ` +
      `okno ${params.startsAt.toISOString()} - ${params.endsAt.toISOString()}`
  );
}
