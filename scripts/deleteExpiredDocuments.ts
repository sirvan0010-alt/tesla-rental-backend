/**
 * Retenční skript: maže doklady a fotky vrácení u rezervací starších než DOCUMENT_RETENTION_YEARS.
 * Záznam rezervace zůstává (účetní/AML historie), jen bez citlivých příloh.
 *
 *   DOCUMENT_RETENTION_YEARS=10 npm run retention:cleanup
 */
import { prisma } from "../src/db";
import fs from "fs/promises";
import path from "path";

const RETENTION_YEARS = Number(process.env.DOCUMENT_RETENTION_YEARS ?? 10);

async function deleteFileIfExists(relativeUrl: string | null) {
  if (!relativeUrl) return;
  const filePath = path.join(__dirname, "..", relativeUrl.replace(/^\//, ""));
  try {
    await fs.unlink(filePath);
    console.log(`Smazán soubor: ${filePath}`);
  } catch (err: any) {
    if (err.code !== "ENOENT") {
      console.error(`Nepodařilo se smazat ${filePath}:`, err.message);
    }
  }
}

async function main() {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - RETENTION_YEARS);

  const expired = await prisma.reservation.findMany({
    where: {
      createdAt: { lt: cutoff },
      OR: [
        { driverLicensePhotoUrl: { not: null } },
        { idCardPhotoUrl: { not: null } },
      ],
    },
  });

  console.log(`Nalezeno ${expired.length} rezervací starších než ${RETENTION_YEARS} let s doklady.`);

  for (const r of expired) {
    await deleteFileIfExists(r.driverLicensePhotoUrl);
    await deleteFileIfExists(r.idCardPhotoUrl);
    for (const url of r.returnPhotosUrls) {
      await deleteFileIfExists(url);
    }
    await prisma.reservation.update({
      where: { id: r.id },
      data: {
        driverLicensePhotoUrl: null,
        idCardPhotoUrl: null,
        returnPhotosUrls: [],
      },
    });
    console.log(`Rezervace ${r.id}: doklady vymazány (retenční lhůta vypršela).`);
  }

  console.log("Hotovo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
