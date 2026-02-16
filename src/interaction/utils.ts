import { Guild } from "discord.js";

export function expiredMessage(cmd: string) {
  return {
    content: `State expired. Run ${cmd} again.`,
    ephemeral: true as const,
  };
}

export function parseSessionCustomId(customId: string): {
  base: string;
  key: string | null;
  b: string | null;
} {
  const parts = customId.split("|");
  const base = parts[0] ?? "";
  const key = parts[1] ?? null;
  const b = parts[2] ?? null;
  return { base, key, b };
}

export function b64urlEncode(s: string) {
  return Buffer.from(s, "utf8").toString("base64url");
}
export function b64urlDecode(s: string) {
  return Buffer.from(s, "utf8").toString("utf8");
}

export async function resolveGuild(
  client: any,
  guildId: string,
): Promise<Guild | null> {
  const cached = client.guilds.cache.get(guildId) as Guild | undefined;
  if (cached) return cached;

  try {
    const g = (await client.guilds.fetch(guildId)) as Guild;
    return g;
  } catch {
    return null;
  }
}
