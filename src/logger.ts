import pino from "pino";
import { config } from "./config.ts";

export const logger = pino({
  level: config.logLevel,
  transport: config.debugMode
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "SYS:standard" },
      }
    : undefined,
});
