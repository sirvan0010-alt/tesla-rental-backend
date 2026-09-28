import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { prisma } from "../db";
import { getReservation, markReturned } from "../services/reservationService";
import { requireAdminKey } from "../middleware/adminAuth";

const router = Router();

const uploadDir = path.join(__dirname, "..", "..", "uploads", "documents");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${req.params.id}-${file.fieldname}-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Pouze obrázky"));
    cb(null, true);
  },
});

router.post(
  "/:id/upload",
  upload.fields([
    { name: "driverLicense", maxCount: 1 },
    { name: "idCard", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const reservation = await getReservation(req.params.id);
      if (reservation.status !== "DRAFT" && reservation.status !== "PENDING_PAYMENT") {
        return res.status(409).json({ error: "Doklady lze nahrát jen před dokončením platby" });
      }
      const files = req.files as Record<string, Express.Multer.File[]>;
      const data: Record<string, string> = {};
      if (files?.driverLicense?.[0]) {
        data.driverLicensePhotoUrl = `/uploads/documents/${files.driverLicense[0].filename}`;
      }
      if (files?.idCard?.[0]) {
        data.idCardPhotoUrl = `/uploads/documents/${files.idCard[0].filename}`;
      }
      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: "Nebyl nahrán žádný soubor" });
      }
      const updated = await prisma.reservation.update({
        where: { id: req.params.id },
        data,
      });
      res.json({
        driverLicensePhotoUrl: updated.driverLicensePhotoUrl,
        idCardPhotoUrl: updated.idCardPhotoUrl,
      });
    } catch (err) {
      console.error("document upload error", err);
      res.status(400).json({ error: "Nahrání dokladů selhalo" });
    }
  }
);

const returnUploadDir = path.join(__dirname, "..", "..", "uploads", "returns");
fs.mkdirSync(returnUploadDir, { recursive: true });

const returnStorage = multer.diskStorage({
  destination: returnUploadDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${req.params.id}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});
const uploadReturnPhotos = multer({
  storage: returnStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) return cb(new Error("Pouze obrázky"));
    cb(null, true);
  },
});

router.post("/:id/return-photos", uploadReturnPhotos.array("photos", 8), async (req, res) => {
  try {
    const files = (req.files as Express.Multer.File[]) ?? [];
    if (files.length === 0) {
      return res.status(400).json({ error: "Nahrajte prosím alespoň jednu fotku" });
    }
    const urls = files.map((f) => `/uploads/returns/${f.filename}`);
    const updated = await markReturned({ reservationId: req.params.id, photoUrls: urls });
    res.json({ status: updated.status, returnPhotosUrls: updated.returnPhotosUrls });
  } catch (err: any) {
    console.error("return photo upload error", err);
    const code = err?.statusCode === 409 ? 409 : 400;
    res.status(code).json({ error: err?.message || "Nahrání fotek při vrácení selhalo" });
  }
});

router.get("/:id/view", requireAdminKey, async (req, res) => {
  try {
    const r = await getReservation(req.params.id);
    res.json({
      status: r.status,
      customerName: r.customerName,
      customerEmail: r.customerEmail,
      customerPhone: r.customerPhone,
      driverLicensePhotoUrl: r.driverLicensePhotoUrl,
      idCardPhotoUrl: r.idCardPhotoUrl,
      returnPhotosUrls: r.returnPhotosUrls,
      kauceAmountCzk: r.kauceAmountCzk,
      kauceTransId: r.kauceTransId,
      damageNoteText: r.damageNoteText,
    });
  } catch {
    res.status(404).json({ error: "Rezervace nenalezena" });
  }
});

export default router;
