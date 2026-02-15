import {
  Interaction,
  PermissionFlagsBits,
  Presence,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} from "discord.js";
import { logger } from "./logger.js";
import { handleGameshare } from "./commands/gameshare.js";
import { CustomIds } from "./domain/constants.js";
import {
  adminUxStore,
  renderAdminConfigure,
  buildAdminSearchModal,
} from "./services/ux/adminConfigureGamesUx.js";
import {
  userRolesUxStore,
  renderUserRoles,
} from "./services/ux/userRolesUx.js";
import { guildConfigService } from "./services/guildConfigService.js";
import { roleService } from "./services/roleService.js";
import { gameCatalog } from "./catalog/catalog.js";
import { userGameRolePrefRepo } from "./db/repositories/userGameRolePrefRepo.js";
import {
  extractPlayingName,
  matchPresenceToCatalog,
} from "./services/gameDetectionService.js";
import { dmShareFlowService } from "./services/dmShareFlowService.js";
import { optInService } from "./services/optInService.js";
import type { DetailKind, PendingShare } from "./domain/types.js";

function expiredMessage(cmd: string) {
  return {
    content: `State expired. Run ${cmd} again.`,
    ephemeral: true as const,
  };
}

function parseSessionCustomId(customId: string): {
  base: string;
  key: string | null;
} {
  const parts = customId.split("|");
  const base = parts[0] ?? "";
  const key = parts[1] ?? null;
  return { base, key };
}

export function registerAppHandlers(client: any) {
  client.on("interactionCreate", async (interaction: Interaction) => {
    try {
      // Slash commands
      if (interaction.isChatInputCommand()) {
        if (interaction.commandName === "gameshare") {
          await handleGameshare(interaction);
        }
        return;
      }

      // Admin + user UI buttons
      if (interaction.isButton()) {
        const { base, key } = parseSessionCustomId(interaction.customId);

        // ----- DM Share Flow Buttons -----
        if (
          base === CustomIds.DmShareYes ||
          base === CustomIds.DmShareNo ||
          base === CustomIds.DmConfirmPost ||
          base === CustomIds.DmCancelPost
        ) {
          const parsed = dmShareFlowService.parseDmId(interaction.customId);
          if (!parsed) {
            return interaction.reply({
              content:
                "That share request expired. Start playing again to re-trigger it.",
              ephemeral: true,
            });
          }

          const { guildId, userId, gameId } = parsed;

          // Always ACK quickly to avoid "interaction failed"
          await interaction.deferUpdate().catch(() => null);

          const game = gameCatalog.getById(gameId);
          const gameName = game?.name ?? "that game";

          const share: PendingShare = {
            guildId,
            userId,
            gameId,
            gameName,
            detailKind: "NONE",
          };

          if (base === CustomIds.DmShareNo) {
            await dmShareFlowService
              .setInFlight(guildId, userId, gameId, false)
              .catch(() => null);
            // Remove buttons to prevent double clicks
            await interaction.message
              .edit({ components: [] })
              .catch(() => null);
            return;
          }

          if (base === CustomIds.DmShareYes) {
            // Move to detail picker
            await interaction.message
              .edit({ components: [] })
              .catch(() => null);
            await dmShareFlowService.sendDetailPickerDm(
              interaction.user,
              share,
            );
            return;
          }

          if (base === CustomIds.DmCancelPost) {
            await interaction.message
              .edit({ components: [] })
              .catch(() => null);
            dmShareFlowService.cacheDelete(guildId, userId, gameId);
            await dmShareFlowService
              .setInFlight(guildId, userId, gameId, false)
              .catch(() => null);
            return;
          }

          if (base === CustomIds.DmConfirmPost) {
            const cached = dmShareFlowService.cacheGet(guildId, userId, gameId);
            if (!cached) {
              await interaction.user
                .send("That share request expired. Please try again.")
                .catch(() => null);
              return;
            }

            // Post in announce channel
            const cfg = await guildConfigService.getOrCreate(guildId);
            if (!cfg.announceChannelId) {
              await interaction.user
                .send(
                  "Sharing is unavailable because the server hasn’t configured an announce channel. Ask an admin to run `/gameshare admin set-channel`.",
                )
                .catch(() => null);
              return;
            }

            const guild = await (async () => {
              const g =
                client.guilds.cache.get(guildId) ??
                (await client.guilds.fetch(guildId).catch(() => null));
              return g;
            })();

            if (!guild) {
              await interaction.user
                .send(
                  "I couldn’t find that server. Ask an admin to re-invite the bot.",
                )
                .catch(() => null);
              return;
            }

            const channel = await guild.channels
              .fetch(cfg.announceChannelId)
              .catch(() => null);
            if (!channel || channel.type !== ChannelType.GuildText) {
              await interaction.user
                .send(
                  "Announce channel is missing or not a text channel. Ask an admin to re-set it.",
                )
                .catch(() => null);
              return;
            }

            const roleId = await guildConfigService.getRoleId(guildId, gameId);
            const roleMention = roleId ? `<@&${roleId}>` : "";

            const detailPart =
              cached.detailKind === "NONE"
                ? ""
                : cached.detailKind === "STEAM"
                  ? ` Join: Steam ID ${cached.detailValue}`
                  : cached.detailKind === "SERVER_NAME"
                    ? ` Join: ${cached.detailValue}`
                    : ` Join: ${cached.detailValue}`;

            await (channel as any).send(
              `${roleMention} <@${userId}> is playing **${cached.gameName}**.${detailPart}`.trim(),
            );

            await interaction.message
              .edit({ components: [] })
              .catch(() => null);
            dmShareFlowService.cacheDelete(guildId, userId, gameId);
            await dmShareFlowService
              .setInFlight(guildId, userId, gameId, false)
              .catch(() => null);

            await interaction.user.send("✅ Posted!").catch(() => null);
            return;
          }
        }

        // Admin "delete roles" options are keyed by guildId, not session
        if (base === CustomIds.AdminConfigureDeleteRolesToggle) {
          if (!interaction.inGuild() || !interaction.guildId) {
            return interaction.reply({
              content: "Guild only.",
              ephemeral: true,
            });
          }
          const guildId = interaction.customId.split("|")[1];
          if (!guildId)
            return interaction.reply(
              expiredMessage("/gameshare admin configure-games"),
            );

          const memberPerms = interaction.memberPermissions;
          const isAdmin =
            memberPerms?.has(PermissionFlagsBits.ManageGuild) ||
            memberPerms?.has(PermissionFlagsBits.Administrator);

          if (!isAdmin)
            return interaction.reply({
              content: "Admin only.",
              ephemeral: true,
            });

          const cfg = await guildConfigService.getOrCreate(guildId);
          await guildConfigService.setDeleteDisabledRoles(
            guildId,
            !cfg.deleteDisabledRoles,
          );

          // Just acknowledge; the admin can re-open status/config if they want.
          return interaction.reply({
            content: `✅ Delete roles for disabled games is now **${!cfg.deleteDisabledRoles ? "ON" : "OFF"}**.`,
            ephemeral: true,
          });
        }

        if (base === CustomIds.AdminConfigureDeleteRolesConfirm) {
          // Safe default in this app: this button exists but actual deletion logic may be implemented later.
          // Don’t crash; just message clearly.
          return interaction.reply({
            content:
              "This build does not auto-delete roles yet (safe default). Disable games and manually delete roles if desired.",
            ephemeral: true,
          });
        }

        // Admin configure session-based buttons
        if (
          base === CustomIds.AdminConfigureSearch ||
          base === CustomIds.AdminConfigurePrev ||
          base === CustomIds.AdminConfigureNext ||
          base === CustomIds.AdminConfigureDone
        ) {
          if (!key)
            return interaction.reply(
              expiredMessage("/gameshare admin configure-games"),
            );

          const state = adminUxStore.get(key);
          if (!state)
            return interaction.reply(
              expiredMessage("/gameshare admin configure-games"),
            );
          adminUxStore.touch(key);

          if (base === CustomIds.AdminConfigureSearch) {
            return interaction.showModal(buildAdminSearchModal(key));
          }

          if (base === CustomIds.AdminConfigurePrev) {
            const next = adminUxStore.update(key, (s) => ({
              ...s,
              page: Math.max(0, s.page - 1),
            }));
            if (!next)
              return interaction.reply(
                expiredMessage("/gameshare admin configure-games"),
              );
            return interaction.update(await renderAdminConfigure(key, next));
          }

          if (base === CustomIds.AdminConfigureNext) {
            const next = adminUxStore.update(key, (s) => ({
              ...s,
              page: s.page + 1,
            }));
            if (!next)
              return interaction.reply(
                expiredMessage("/gameshare admin configure-games"),
              );
            return interaction.update(await renderAdminConfigure(key, next));
          }

          if (base === CustomIds.AdminConfigureDone) {
            adminUxStore.delete(key);
            return interaction.update({
              content: "✅ Done.",
              embeds: [],
              components: [],
            });
          }
        }

        // User roles session-based buttons
        if (
          base === CustomIds.UserRolesPrev ||
          base === CustomIds.UserRolesNext ||
          base === CustomIds.UserRolesClearAll
        ) {
          if (!key)
            return interaction.reply(expiredMessage("/gameshare roles"));

          const state = userRolesUxStore.get(key);
          if (!state)
            return interaction.reply(expiredMessage("/gameshare roles"));
          userRolesUxStore.touch(key);

          if (base === CustomIds.UserRolesPrev) {
            const next = userRolesUxStore.update(key, (s) => ({
              ...s,
              page: Math.max(0, s.page - 1),
            }));
            if (!next)
              return interaction.reply(expiredMessage("/gameshare roles"));
            return interaction.update(await renderUserRoles(key, next));
          }

          if (base === CustomIds.UserRolesNext) {
            const next = userRolesUxStore.update(key, (s) => ({
              ...s,
              page: s.page + 1,
            }));
            if (!next)
              return interaction.reply(expiredMessage("/gameshare roles"));
            return interaction.update(await renderUserRoles(key, next));
          }

          if (base === CustomIds.UserRolesClearAll) {
            await userGameRolePrefRepo.clear(state.guildId, state.userId);

            // Remove roles too (best-effort)
            if (interaction.inGuild()) {
              const guild = interaction.guild;
              const member = await guild?.members
                .fetch(state.userId)
                .catch(() => null);
              if (guild && member) {
                const enabledIds = await guildConfigService.listEnabledGameIds(
                  state.guildId,
                );
                for (const gameId of enabledIds) {
                  const roleId = await guildConfigService.getRoleId(
                    state.guildId,
                    gameId,
                  );
                  if (!roleId) continue;
                  const role = guild.roles.cache.get(roleId);
                  if (!role) continue;
                  const can = await roleService.canManageRole(guild, role);
                  if (can.ok) await member.roles.remove(role).catch(() => null);
                }
              }
            }

            const next = userRolesUxStore.get(key);
            if (!next)
              return interaction.reply(expiredMessage("/gameshare roles"));
            return interaction.update(await renderUserRoles(key, next));
          }
        }

        // If we got here, it's a button we don't handle
        return;
      }

      // Select menus
      if (interaction.isStringSelectMenu()) {
        const { base, key } = parseSessionCustomId(interaction.customId);

        if (base === CustomIds.DmDetailPick) {
          const parsed = dmShareFlowService.parseDmId(interaction.customId);
          if (!parsed) {
            return interaction.reply({
              content: "That share request expired.",
              ephemeral: true,
            });
          }

          const { guildId, userId, gameId } = parsed;

          // ACK fast
          await interaction.deferUpdate().catch(() => null);

          const game = gameCatalog.getById(gameId);
          const gameName = game?.name ?? "that game";

          const detailKind = (interaction.values[0] ?? "NONE") as DetailKind;

          const share: PendingShare = {
            guildId,
            userId,
            gameId,
            gameName,
            detailKind,
          };

          if (detailKind === "NONE") {
            // Build a preview and ask confirm
            dmShareFlowService.cachePut(share);

            await interaction.user.send({
              content: `Preview:\n**${gameName}**\nNo extra details.\n\nPost this to the server?`,
              components: [
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                  new ButtonBuilder()
                    .setCustomId(
                      dmShareFlowService.dmId(CustomIds.DmConfirmPost, share),
                    )
                    .setLabel("Confirm")
                    .setStyle(ButtonStyle.Primary),
                  new ButtonBuilder()
                    .setCustomId(
                      dmShareFlowService.dmId(CustomIds.DmCancelPost, share),
                    )
                    .setLabel("Cancel")
                    .setStyle(ButtonStyle.Secondary),
                ),
              ],
            });

            return;
          }

          // Need user input via modal
          await interaction.showModal(
            dmShareFlowService.buildModal(detailKind, share),
          );
          return;
        }

        // Admin toggle select (enable/disable)
        if (base === CustomIds.AdminConfigureToggleSelect) {
          if (!key)
            return interaction.reply(
              expiredMessage("/gameshare admin configure-games"),
            );

          const state = adminUxStore.get(key);
          if (!state)
            return interaction.reply(
              expiredMessage("/gameshare admin configure-games"),
            );
          adminUxStore.touch(key);

          if (!interaction.inGuild() || !interaction.guild) {
            return interaction.reply({
              content: "Guild only.",
              ephemeral: true,
            });
          }

          const memberPerms = interaction.memberPermissions;
          const isAdmin =
            memberPerms?.has(PermissionFlagsBits.ManageGuild) ||
            memberPerms?.has(PermissionFlagsBits.Administrator);

          if (!isAdmin)
            return interaction.reply({
              content: "Admin only.",
              ephemeral: true,
            });

          const guild = interaction.guild;

          // For each selected on the page, toggle enable/disable
          for (const gameId of interaction.values) {
            const enabled = await guildConfigService.isEnabled(
              state.guildId,
              gameId,
            );
            const game = gameCatalog.getById(gameId);
            if (!game) continue;

            if (!enabled) {
              // enable -> ensure role exists, store mapping
              await guildConfigService.enableGame(state.guildId, gameId);
              const role = await roleService.ensureGameRole(guild, game.name);
              await guildConfigService.setRoleId(
                state.guildId,
                gameId,
                role.id,
              );
            } else {
              // disable -> do not delete roles (safe default)
              await guildConfigService.disableGame(state.guildId, gameId);
            }
          }

          const refreshed = adminUxStore.get(key);
          if (!refreshed)
            return interaction.reply(
              expiredMessage("/gameshare admin configure-games"),
            );
          return interaction.update(await renderAdminConfigure(key, refreshed));
        }

        // User roles select (choose game roles)
        if (base === CustomIds.UserRolesPickSelect) {
          if (!key)
            return interaction.reply(expiredMessage("/gameshare roles"));

          const state = userRolesUxStore.get(key);
          if (!state)
            return interaction.reply(expiredMessage("/gameshare roles"));
          userRolesUxStore.touch(key);

          // Save prefs (selected game ids on THIS page; but we treat it as "selected for whole guild")
          // To avoid confusion, we combine currently stored selections with this page's selections.
          const enabledIds = await guildConfigService.listEnabledGameIds(
            state.guildId,
          );
          const enabledSet = new Set(enabledIds);

          const current = new Set(
            await userGameRolePrefRepo.listSelectedGameIds(
              state.guildId,
              state.userId,
            ),
          );

          // Determine what games were shown on this page
          const enabledGames = enabledIds
            .map((id) => gameCatalog.getById(id))
            .filter(Boolean);
          const start = state.page * 20;
          const pageItems = enabledGames
            .slice(start, start + 20)
            .map((g) => g!.id);

          // Remove any from this page, then add chosen values
          for (const g of pageItems) current.delete(g);
          for (const v of interaction.values) {
            if (enabledSet.has(v)) current.add(v);
          }

          await userGameRolePrefRepo.setSelectedGameIds(
            state.guildId,
            state.userId,
            Array.from(current),
          );

          // Apply roles in guild (best effort)
          if (interaction.inGuild() && interaction.guild) {
            const guild = interaction.guild;
            const member = await guild.members
              .fetch(state.userId)
              .catch(() => null);
            if (member) {
              // Add roles for selected; remove roles for deselected (only among enabled)
              for (const gameId of enabledIds) {
                const roleId = await guildConfigService.getRoleId(
                  state.guildId,
                  gameId,
                );
                if (!roleId) continue;
                const role = guild.roles.cache.get(roleId);
                if (!role) continue;

                const wants = current.has(gameId);
                const has = member.roles.cache.has(roleId);
                const can = await roleService.canManageRole(guild, role);

                if (!can.ok) continue;

                if (wants && !has)
                  await member.roles.add(role).catch(() => null);
                if (!wants && has)
                  await member.roles.remove(role).catch(() => null);
              }
            }
          }

          const refreshed = userRolesUxStore.get(key);
          if (!refreshed)
            return interaction.reply(expiredMessage("/gameshare roles"));
          return interaction.update(await renderUserRoles(key, refreshed));
        }

        return;
      }

      // Modals
      if (interaction.isModalSubmit()) {
        const { base, key } = parseSessionCustomId(interaction.customId);

        // ----- DM Share Flow Modals -----
        if (
          base === CustomIds.DmModalSteam ||
          base === CustomIds.DmModalServerName ||
          base === CustomIds.DmModalServerIp
        ) {
          const parsed = dmShareFlowService.parseDmId(interaction.customId);
          if (!parsed) {
            return interaction.reply({
              content: "That share request expired.",
              ephemeral: true,
            });
          }

          const { guildId, userId, gameId } = parsed;

          const game = gameCatalog.getById(gameId);
          const gameName = game?.name ?? "that game";

          const detailKind: DetailKind =
            base === CustomIds.DmModalSteam
              ? "STEAM"
              : base === CustomIds.DmModalServerName
                ? "SERVER_NAME"
                : "SERVER_IP";

          const value =
            interaction.fields.getTextInputValue("value")?.trim() ?? "";
          const valid = dmShareFlowService.validateDetail(detailKind, value);

          if (!valid.ok) {
            return interaction.reply({
              content: `❌ ${valid.message ?? "Invalid value."}`,
              ephemeral: true,
            });
          }

          const share: PendingShare = {
            guildId,
            userId,
            gameId,
            gameName,
            detailKind,
            detailValue: value,
          };
          dmShareFlowService.cachePut(share);

          // Reply with preview + confirm buttons
          return interaction.reply({
            content: `Preview:\n**${gameName}**\n${detailKind === "STEAM" ? `Steam ID: ${value}` : detailKind === "SERVER_NAME" ? `Server: ${value}` : `Join: ${value}`}\n\nPost this to the server?`,
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    dmShareFlowService.dmId(CustomIds.DmConfirmPost, share),
                  )
                  .setLabel("Confirm")
                  .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                  .setCustomId(
                    dmShareFlowService.dmId(CustomIds.DmCancelPost, share),
                  )
                  .setLabel("Cancel")
                  .setStyle(ButtonStyle.Secondary),
              ),
            ],
          });
        }

        // Admin search modal submit
        if (base === CustomIds.AdminConfigureSearch) {
          if (!key)
            return interaction.reply(
              expiredMessage("/gameshare admin configure-games"),
            );

          const state = adminUxStore.get(key);
          if (!state)
            return interaction.reply(
              expiredMessage("/gameshare admin configure-games"),
            );
          adminUxStore.touch(key);

          const q = (
            interaction.fields.getTextInputValue("query") ?? ""
          ).trim();
          const next = adminUxStore.update(key, (s) => ({
            ...s,
            query: q,
            page: 0,
          }));
          if (!next)
            return interaction.reply(
              expiredMessage("/gameshare admin configure-games"),
            );

          // Modal submits must reply (or defer+edit) — easiest is ephemeral reply
          const ui = await renderAdminConfigure(key, next);
          return interaction.reply({ ...(ui as any), ephemeral: true });
        }

        return;
      }
    } catch (err) {
      logger.error({ err }, "interactionCreate handler error");
      try {
        if (interaction.isRepliable()) {
          await interaction.reply({
            content: "Something went wrong. Check logs.",
            ephemeral: true,
          });
        }
      } catch {
        // ignore
      }
    }
  });

  client.on(
    "presenceUpdate",
    async (oldPresence: Presence | null, newPresence: Presence) => {
      try {
        const guildId = newPresence.guild?.id;
        const userId = newPresence.userId;
        if (!guildId || !userId) return;

        const optedIn = await optInService.isOptedIn(guildId, userId);
        if (!optedIn) return;

        const oldName = extractPlayingName(oldPresence);
        const newName = extractPlayingName(newPresence);

        if (!newName) return;
        if (oldName && oldName === newName) return; // still same game

        const matched = matchPresenceToCatalog(newName);
        if (!matched) return;

        const enabled = await guildConfigService.isEnabled(guildId, matched.id);
        if (!enabled) return;

        // Avoid spam: cooldown + in-flight
        const canPrompt = await dmShareFlowService.canPrompt(
          guildId,
          userId,
          matched.id,
        );
        if (!canPrompt) return;

        const inFlight = await dmShareFlowService.isInFlight(
          guildId,
          userId,
          matched.id,
        );
        if (inFlight) return;

        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) return;

        await dmShareFlowService.setInFlight(guildId, userId, matched.id, true);
        await dmShareFlowService.markPrompted(guildId, userId, matched.id);

        await dmShareFlowService.sendInitialDm(user, {
          guildId,
          userId,
          gameId: matched.id,
          gameName: matched.name,
          detailKind: "NONE",
        });
      } catch (err) {
        logger.warn({ err }, "presenceUpdate handler failed");
      }
    },
  );
}
