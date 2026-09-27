import "dotenv/config";
import { createApp } from "./app";

// --- Startup guard: doklady a admin sekce nesmí jít do ostrého provozu
// s chybějícím nebo výchozím ADMIN_API_KEY. V MOCK_MODE je to jen varování
// (lokální vývoj), mimo MOCK_MODE server rovnou odmítne nastartovat.
const isMock = process.env.MOCK_MODE === "true";
const adminKey = process.env.ADMIN_API_KEY;
const isDefaultAdminKey =
  !adminKey || adminKey === "dev-admin-key-change-in-production" || adminKey === "change-me";

if (isDefaultAdminKey) {
  if (isMock) {
    console.warn(
      "⚠️  ADMIN_API_KEY není nastaven nebo je na výchozí hodnotě - v pořádku pro lokální MOCK_MODE, ale před ostrým provozem MUSÍ být změněn."
    );
  } else {
    console.error(
      "✖ ADMIN_API_KEY chybí nebo je na výchozí/testovací hodnotě, ale MOCK_MODE=false (ostrý provoz). " +
        "Server se z bezpečnostních důvodů nespustí - admin sekce a doklady zákazníků by jinak byly " +
        "přístupné komukoliv, kdo zná výchozí klíč. Nastavte silný náhodný ADMIN_API_KEY v .env a zkuste to znovu."
    );
    process.exit(1);
  }
}

const app = createApp();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  console.log(`Tesla rental payment backend listening on :${port}`);
});
