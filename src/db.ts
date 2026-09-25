import { PrismaClient } from "@prisma/client";

// Jeden sdílený PrismaClient pro celou appku (doporučený vzor u serverless/dev reload)
export const prisma = new PrismaClient();
