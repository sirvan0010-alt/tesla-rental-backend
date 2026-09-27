import path from "path";
import express from "express";
import cors from "cors";
import paymentRouter from "./routes/payment";
import documentsRouter from "./routes/documents";
import vehiclesRouter from "./routes/vehicles";
import { requireAdminKey } from "./middleware/adminAuth";

/**
 * Express app bez listen() — aby šla importovat v integračních testech.
 * Startup guard (ADMIN_API_KEY) zůstává v server.ts.
 */
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api/payment", paymentRouter);
  app.use("/api/documents", documentsRouter);
  app.use("/api/vehicles", vehiclesRouter);

  app.use(
    "/uploads/documents",
    requireAdminKey,
    express.static(path.join(__dirname, "..", "uploads", "documents"))
  );
  app.use(
    "/uploads/returns",
    requireAdminKey,
    express.static(path.join(__dirname, "..", "uploads", "returns"))
  );

  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  return app;
}
