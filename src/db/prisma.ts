import { PrismaClient } from "@prisma/client";
import { logger } from "../logger.ts";

export const prisma = new PrismaClient();

export async function initDb() {
  try {
    await prisma.$connect();
    logger.info("Connected to database");
  } catch (err) {
    logger.error({ err }, "Failed to connect to DB");
    throw err;
  }
}
