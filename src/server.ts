import "dotenv/config";
import path from "path";
import express from "express";
import cors from "cors";
import paymentRouter from "./routes/payment";
import documentsRouter from "./routes/documents";
import vehiclesRouter from "./routes/vehicles";
import { requireAdminKey } from "./middleware/adminAuth";

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

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/payment", paymentRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/vehicles", vehiclesRouter);

app.use("/uploads/documents", requireAdminKey, express.static(path.join(__dirname, "..", "uploads", "documents")));
app.use("/uploads/returns", requireAdminKey, express.static(path.join(__dirname, "..", "uploads", "returns")));

app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (_req, res) => res.json({ ok: true }));

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  console.log(`Tesla rental payment backend listening on :${port}`);
});
