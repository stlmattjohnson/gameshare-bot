import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  User,
} from "discord.js";
import { CustomIds } from "../domain/constants.ts";
import { logger } from "../logger.ts";
import { config } from "../config.ts";
import { cooldownRepo } from "../db/repositories/cooldownRepo.ts";
import { gamePromptTimeoutRepo } from "../db/repositories/gamePromptTimeoutRepo.ts";
import { guildConfigService } from "./guildConfigService.ts";
import { prisma } from "../db/prisma.ts";
import { Share, DetailKind } from "../domain/types.ts";
import { userDataRepo } from "../db/repositories/userDataRepo.ts";

const now = () => {
  return new Date();
};

const minutesAgo = (d: Date, minutes: number) => {
  return new Date(d.getTime() + minutes * 60_000);
};

const pendingShareCache = new Map<string, Share>();
const cacheKey = (s: Share) => `${s.guildId}:${s.userId}:${s.gameId}`;

// Track DM message IDs for in-flight share flows so we can edit the same message
const pendingDmMessageMap = new Map<string, string>();
const dmKey = (guildId: string, userId: string, gameId: string) =>
  `${guildId}:${userId}:${gameId}`;

// Persist posted announce messages so reaction handlers can map message -> role/game
type PostedMapping = {
  sessionId?: number;
  messageId?: string;
  guildId: string;
  channelId?: string;
  userId?: string;
  gameId: string;
  roleId?: string;
  detailKind?: string;
  detailValue?: string;
};

export const dmShareFlowService = {
  cachePut(share: Share) {
    pendingShareCache.set(cacheKey(share), share);
  },

  cacheSetDmMessageId(
    guildId: string,
    userId: string,
    gameId: string,
    messageId: string,
  ) {
    pendingDmMessageMap.set(dmKey(guildId, userId, gameId), messageId);
  },

  cacheGetDmMessageId(
    guildId: string,
    userId: string,
    gameId: string,
  ): string | null {
    return pendingDmMessageMap.get(dmKey(guildId, userId, gameId)) ?? null;
  },

  cacheGet(guildId: string, userId: string, gameId: string): Share | null {
    return pendingShareCache.get(`${guildId}:${userId}:${gameId}`) ?? null;
  },

  cacheDelete(guildId: string, userId: string, gameId: string) {
    pendingShareCache.delete(`${guildId}:${userId}:${gameId}`);
    pendingDmMessageMap.delete(dmKey(guildId, userId, gameId));
  },

  async canPrompt(
    guildId: string,
    userId: string,
    gameId: string,
  ): Promise<boolean> {
    const last = await cooldownRepo.getLastPromptedAt(guildId, userId, gameId);
    if (!last) return true;
    return minutesAgo(last, config.promptCooldownMinutes) < now()
      ? true
      : false;
  },

  async markPrompted(guildId: string, userId: string, gameId: string) {
    await cooldownRepo.touch(guildId, userId, gameId, now());
  },

  async isTimedOut(
    guildId: string,
    userId: string,
    gameId: string,
  ): Promise<boolean> {
    const row = await gamePromptTimeoutRepo.get(guildId, userId, gameId);
    if (!row) return false;
    return row.until > now();
  },

  async setTimeoutDays(
    guildId: string,
    userId: string,
    gameId: string,
    days: number,
  ) {
    const until = new Date(now().getTime() + days * 24 * 60 * 60_000);
    await gamePromptTimeoutRepo.upsert(guildId, userId, gameId, until);
  },

  async clearTimeouts(guildId: string, userId: string) {
    await gamePromptTimeoutRepo.clearForUser(guildId, userId);
  },

  async setInFlight(
    guildId: string,
    userId: string,
    gameId: string,
    inFlight: boolean,
  ) {
    await prisma.shareRequestState.upsert({
      where: { guildId_userId_gameId: { guildId, userId, gameId } },
      update: { status: inFlight ? "IN_FLIGHT" : "IDLE" },
      create: {
        guildId,
        userId,
        gameId,
        status: inFlight ? "IN_FLIGHT" : "IDLE",
      },
    });
  },

  async isInFlight(
    guildId: string,
    userId: string,
    gameId: string,
  ): Promise<boolean> {
    const row = await prisma.shareRequestState.findUnique({
      where: { guildId_userId_gameId: { guildId, userId, gameId } },
    });
    return row?.status === "IN_FLIGHT";
  },

  async sendInitialDm(user: User, share: Share) {
    const embed = new EmbedBuilder()
      .setTitle("Share your game?")
      .setDescription(
        `You started playing **${share.gameName}**.\nWant to share with the server?`,
      )
      .setFooter({ text: "You control what gets shared." });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(this.dmId(CustomIds.DmShareYes, share))
        .setLabel("Share")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(this.dmId(CustomIds.DmShareNo, share))
        .setLabel("Not now")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(this.dmId(CustomIds.DmTimeout1d, share))
        .setLabel("Timeout: 1 day")
        .setEmoji("⏰")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(this.dmId(CustomIds.DmTimeout1w, share))
        .setLabel("Timeout: 1 week")
        .setEmoji("⏰")
        .setStyle(ButtonStyle.Danger),
    );

    try {
      const sent = await user.send({ embeds: [embed], components: [row] });
      // store in-memory share + message id so subsequent steps edit this message
      this.cachePut(share);
      this.cacheSetDmMessageId(
        share.guildId,
        share.userId,
        share.gameId,
        sent.id,
      );
      logger.info(
        {
          guildId: share.guildId,
          userId: share.userId,
          gameId: share.gameId,
          messageId: sent.id,
        },
        "Sent DM prompt",
      );
    } catch (err) {
      logger.warn(
        { err, guildId: share.guildId, userId: share.userId },
        "Failed to DM user (DMs closed?)",
      );
      throw err;
    }
  },

  async sendDetailPickerDm(user: User, share: Share) {
    const embed = new EmbedBuilder()
      .setTitle("What detail do you want to share?")
      .setDescription("Pick one option. You'll see a preview before posting.");

    const select = new StringSelectMenuBuilder()
      .setCustomId(this.dmId(CustomIds.DmDetailPick, share))
      .setPlaceholder("Choose a detail to share")
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel("Share without details")
          .setValue("NONE"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Steam ID")
          .setValue("STEAM"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Server Name")
          .setValue("SERVER_NAME"),
        new StringSelectMenuOptionBuilder()
          .setLabel("Server IP (ip:port or hostname:port)")
          .setValue("SERVER_IP"),
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      select,
    );
    // Edit the original DM message if present, otherwise send a new DM
    const messageId = this.cacheGetDmMessageId(
      share.guildId,
      share.userId,
      share.gameId,
    );
    if (messageId) {
      const dm = await user.createDM().catch(() => null);
      const msg = dm
        ? await dm.messages.fetch(messageId).catch(() => null)
        : null;
      if (msg) {
        await msg
          .edit({ embeds: [embed], components: [row] })
          .catch(() => null);
        return;
      }
    }

    const sent = await user
      .send({ embeds: [embed], components: [row] })
      .catch(() => null);
    if (sent)
      this.cacheSetDmMessageId(
        share.guildId,
        share.userId,
        share.gameId,
        sent.id,
      );
  },

  buildModal(detail: DetailKind, share: Share) {
    const modalId =
      detail === "STEAM"
        ? CustomIds.DmModalSteam
        : detail === "SERVER_NAME"
          ? CustomIds.DmModalServerName
          : CustomIds.DmModalServerIp;

    const modal = new ModalBuilder()
      .setCustomId(this.dmId(modalId, share))
      .setTitle(
        `Share ${detail === "STEAM" ? "Steam ID" : detail === "SERVER_NAME" ? "Server Name" : "Server IP"}`,
      );

    const input = new TextInputBuilder()
      .setCustomId("value")
      .setLabel(
        detail === "STEAM"
          ? "Steam ID"
          : detail === "SERVER_NAME"
            ? "Server name"
            : "Server address",
      )
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(detail === "SERVER_NAME" ? 80 : 80)
      .setPlaceholder(
        detail === "STEAM"
          ? "e.g., 7656119..."
          : detail === "SERVER_NAME"
            ? "e.g., Chill Squad NA #2"
            : "e.g., 1.2.3.4:27015",
      );

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(input),
    );
    return modal;
  },

  validateDetail(
    kind: DetailKind,
    value: string,
  ): { ok: boolean; message?: string } {
    const v = value.trim();
    if (!v) return { ok: false, message: "Value cannot be empty." };

    if (kind === "STEAM") {
      // Light validation: allow various formats, but warn on extremely short
      if (v.length < 6)
        return { ok: false, message: "That Steam ID looks too short." };
      return { ok: true };
    }

    if (kind === "SERVER_IP") {
      // Accept hostname:port or ip:port, optional port but recommended
      const hostPort = /^([a-zA-Z0-9.\-]+)(:\d{2,5})?$/.test(v);
      if (!hostPort)
        return { ok: false, message: "Use hostname[:port] or ip[:port]." };
      return { ok: true };
    }

    if (kind === "SERVER_NAME") {
      if (v.length > 80)
        return { ok: false, message: "Server name is too long." };
      return { ok: true };
    }

    return { ok: true };
  },

  async sendPreviewDm(user: User, share: Share) {
    const detailLine =
      share.detailKind === "NONE"
        ? ""
        : share.detailKind === "STEAM"
          ? `Steam ID: \`${share.detailValue}\``
          : share.detailKind === "SERVER_NAME"
            ? `Server: **${share.detailValue}**`
            : `Join: \`${share.detailValue}\``;

    const embed = new EmbedBuilder()
      .setTitle("Preview")
      .setDescription(
        [
          `**Game:** ${share.gameName}`,
          share.detailKind === "NONE"
            ? "**Detail:** none"
            : `**Detail:** ${detailLine}`,
        ].join("\n"),
      )
      .setFooter({ text: "Confirm to post in the server channel." });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(this.dmId(CustomIds.DmConfirmPost, share))
        .setLabel("Confirm")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(this.dmId(CustomIds.DmCancelPost, share))
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary),
    );

    const messageId = this.cacheGetDmMessageId(
      share.guildId,
      share.userId,
      share.gameId,
    );
    if (messageId) {
      const dm = await user.createDM().catch(() => null);
      const msg = dm
        ? await dm.messages.fetch(messageId).catch(() => null)
        : null;
      if (msg) {
        await msg
          .edit({ embeds: [embed], components: [row] })
          .catch(() => null);
        return;
      }
    }

    const sent = await user
      .send({ embeds: [embed], components: [row] })
      .catch(() => null);
    if (sent)
      this.cacheSetDmMessageId(
        share.guildId,
        share.userId,
        share.gameId,
        sent.id,
      );
  },

  async postToAnnounceChannel(share: Share) {
    const cfg = await guildConfigService.getOrCreate(share.guildId);
    if (!cfg.announceChannelId) {
      throw new Error("Announce channel is not configured.");
    }

    // Fetch guild + channel via client in interaction handlers (keeps service pure-ish),
    // so this method is called with channel object in real path. For simplicity, we provide a helper in handler.
  },

  async optionallyRememberDetail(
    guildId: string,
    userId: string,
    kind: DetailKind,
    value?: string,
  ) {
    // Minimal retention: store last-used value (optional). Users can delete via /gameshare delete-my-data.
    if (kind === "STEAM")
      await userDataRepo.upsertDetails(guildId, userId, {
        steamId: value ?? null,
      });
    if (kind === "SERVER_NAME")
      await userDataRepo.upsertDetails(guildId, userId, {
        serverName: value ?? null,
      });
    if (kind === "SERVER_IP")
      await userDataRepo.upsertDetails(guildId, userId, {
        serverIp: value ?? null,
      });
  },

  dmId(base: string, share: Share) {
    // Encode state into customId (within 100 chars): base|guild|user|game
    return `${base}|${share.guildId}|${share.userId}|${share.gameId}`.slice(
      0,
      100,
    );
  },

  async registerPostedMessage(
    messageId: string,
    guildId: string,
    channelId: string,
    userId: string,
    gameId: string,
    roleId?: string,
    detailKind?: string,
    detailValue?: string,
  ) {
    const row = await prisma.session.upsert({
      where: { messageId },
      update: {
        guildId,
        channelId,
        userId,
        gameId,
        roleId,
        detailKind: detailKind ?? null,
        detailValue: detailValue ?? null,
        active: true,
      },
      create: {
        messageId,
        guildId,
        channelId,
        userId,
        gameId,
        roleId,
        detailKind: detailKind ?? null,
        detailValue: detailValue ?? null,
        active: true,
      },
    });
    return row;
  },

  async getPostedMessage(messageId: string): Promise<PostedMapping | null> {
    const row = await prisma.session.findUnique({ where: { messageId } });
    if (!row || !row.active) return null;
    return {
      sessionId: row.id,
      messageId: row.messageId,
      guildId: row.guildId,
      channelId: row.channelId,
      userId: row.userId,
      gameId: row.gameId,
      roleId: row.roleId ?? undefined,
      detailKind: row.detailKind ?? undefined,
      detailValue: row.detailValue ?? undefined,
    };
  },

  async unregisterPostedMessage(messageId: string) {
    await prisma.session
      .updateMany({ where: { messageId }, data: { active: false } })
      .catch(() => null);
  },

  async getActiveSessionsForUser(guildId: string, userId: string) {
    const rows = await prisma.session.findMany({
      where: { guildId, userId, active: true },
    });
    return rows.map((r) => ({
      sessionId: r.id,
      messageId: r.messageId,
      guildId: r.guildId,
      channelId: r.channelId,
      userId: r.userId,
      gameId: r.gameId,
      roleId: r.roleId ?? undefined,
      detailKind: r.detailKind ?? undefined,
      detailValue: r.detailValue ?? undefined,
      createdAt: r.createdAt,
    }));
  },

  async getActiveSessionsForGuild(guildId: string) {
    const rows = await prisma.session.findMany({
      where: { guildId, active: true },
    });
    return rows.map((r) => ({
      sessionId: r.id,
      messageId: r.messageId,
      guildId: r.guildId,
      channelId: r.channelId,
      userId: r.userId,
      gameId: r.gameId,
      roleId: r.roleId ?? undefined,
      detailKind: r.detailKind ?? undefined,
      detailValue: r.detailValue ?? undefined,
      createdAt: r.createdAt,
    }));
  },
  async markSessionInactiveById(sessionId: number) {
    await prisma.session
      .update({ where: { id: sessionId }, data: { active: false } })
      .catch(() => null);
  },

  parseDmId(
    customId: string,
  ): { base: string; guildId: string; userId: string; gameId: string } | null {
    const [base, guildId, userId, gameId] = customId.split("|");
    if (!base || !guildId || !userId || !gameId) return null;
    return { base, guildId, userId, gameId };
  },
};
