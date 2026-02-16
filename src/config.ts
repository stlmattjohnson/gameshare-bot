import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const EnvSchema = z.object({
  DISCORD_TOKEN: z.string().min(1),
  DISCORD_APPLICATION_ID: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.string().default("info"),
  DEBUG_MODE: z.string().optional(),
  PROMPT_COOLDOWN_MINUTES: z.string().optional(),
  ROLE_PREFIX: z.string().optional(),
});

const env = EnvSchema.parse(process.env);

export const config = {
  discordToken: env.DISCORD_TOKEN,
  applicationId: env.DISCORD_APPLICATION_ID,
  databaseUrl: env.DATABASE_URL,
  logLevel: env.LOG_LEVEL,
  debugMode: (env.DEBUG_MODE ?? "false").toLowerCase() === "true",
  //promptCooldownMinutes: Number(env.PROMPT_COOLDOWN_MINUTES ?? "30"),
  promptCooldownMinutes: 0,
  rolePrefix: env.ROLE_PREFIX ?? "Playing: ",
};
