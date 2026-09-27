/**
 * Retence dokladů (GDPR) — maže soubory a nuluje URL na rezervacích starších než RETENTION_YEARS.
 *
 * Spouštění (cron / manuálně):
 *   RETENTION_YEARS=10 npx ts-node scripts/purge-old-documents.ts
 *
 * Výchozí 10 let (typická doporučení pro doklady k pojištění/smlouvám — upřesněte s právníkem).
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import { prisma } from "../src/db";

const YEARS = Number(process.env.RETENTION_YEARS || 10);

async function main() {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - YEARS);

  const old = await prisma.reservation.findMany({
    where: {
      createdAt: { lt: cutoff },
      OR: [
        { driverLicensePhotoUrl: { not: null } },
        { idCardPhotoUrl: { not: null } },
        { returnPhotosUrls: { isEmpty: false } },
      ],
    },
  });

  let filesRemoved = 0;
  for (const r of old) {
    const urls = [r.driverLicensePhotoUrl, r.idCardPhotoUrl, ...(r.returnPhotosUrls || [])].filter(
      Boolean
    ) as string[];
    for (const rel of urls) {
      const disk = path.join(process.cwd(), rel.replace(/^\//, ""));
      try {
        if (fs.existsSync(disk)) {
          fs.unlinkSync(disk);
          filesRemoved++;
        }
      } catch (e) {
        console.warn("Nelze smazat", disk, e);
      }
    }
    await prisma.reservation.update({
      where: { id: r.id },
      data: {
        driverLicensePhotoUrl: null,
        idCardPhotoUrl: null,
        returnPhotosUrls: [],
      },
    });
  }

  console.log(
    `Retence ${YEARS} let: cutoff=${cutoff.toISOString()}, rezervací=${old.length}, smazaných souborů=${filesRemoved}`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
