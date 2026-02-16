import {
  Client,
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from "discord.js";
import { logger } from "../logger.ts";
import { dmShareFlowService } from "../services/dmShareFlowService.ts";

const ADD_EMOJI = "➕";
const REMOVE_EMOJI = "➖";

const abortRoleAction = async (
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
) => {
  try {
    await reaction.users.remove(user.id).catch(() => null);
  } catch {}
};

export const registerReactionHandlers = (client: Client) => {
  client.on("messageReactionAdd", async (reaction, user) => {
    try {
      console.log({
        reaction: reaction.partial ? "partial" : "full",
        user: user.id,
      });
      if (user.bot) return;
      if (reaction.partial) await reaction.fetch().catch(() => null);
      let message = reaction.message;
      if (message && (message as any).partial) {
        await message.fetch().catch(() => null);
      }
      if (!message || !message.id) {
        await abortRoleAction(reaction, user);
        return;
      }
      const mapping = await dmShareFlowService.getPostedMessage(message.id);
      console.log({ mapping });
      if (!mapping) {
        await abortRoleAction(reaction, user);
        return;
      }

      const guild = await client.guilds
        .fetch(mapping.guildId)
        .catch(() => null);
      console.log({ guild });
      if (!guild) {
        await abortRoleAction(reaction, user);
        return;
      }

      const member = await guild.members.fetch(user.id).catch(() => null);
      console.log({ member });
      if (!member) {
        await abortRoleAction(reaction, user);
        return;
      }

      const emoji = reaction.emoji.name;
      console.log({ emoji });
      if (emoji === ADD_EMOJI) {
        if (mapping.roleId) {
          // If user already has the role, remove their reaction to reflect current state
          if (member.roles.cache.has(mapping.roleId)) {
            await abortRoleAction(reaction, user);
          } else {
            await member.roles.add(mapping.roleId).catch(async (err) => {
              logger.warn({ err }, "Failed to add role from reaction");
              await abortRoleAction(reaction, user);
            });
          }
        }
      } else if (emoji === REMOVE_EMOJI) {
        if (mapping.roleId) {
          await member.roles.remove(mapping.roleId).catch(async (err) => {
            logger.warn({ err }, "Failed to remove role from reaction");
            await abortRoleAction(reaction, user);
          });
        }
      }
    } catch (err) {
      logger.error({ err }, "messageReactionAdd handler error");
    }
  });

  client.on("messageReactionRemove", async (reaction, user) => {
    try {
      console.log({
        reaction: reaction.partial ? "partial" : "full",
        user: user.id,
      });
      if (user.bot) return;
      if (reaction.partial) await reaction.fetch().catch(() => null);
      let message = reaction.message;
      if (message && (message as any).partial) {
        await message.fetch().catch(() => null);
      }
      if (!message || !message.id) return;
      const mapping = await dmShareFlowService.getPostedMessage(message.id);
      if (!mapping) return;

      const guild = await client.guilds
        .fetch(mapping.guildId)
        .catch(() => null);
      if (!guild) return;

      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      const emoji = reaction.emoji.name;
      // If a user removes their "add" reaction, remove the role as well
      if (emoji === ADD_EMOJI && mapping.roleId) {
        await member.roles.remove(mapping.roleId).catch(async (err) => {
          logger.warn({ err }, "Failed to remove role on reaction removal");
          // Reaction was already removed by the user; attempt to re-add it to reflect state if possible
          try {
            await message.react(ADD_EMOJI).catch(() => null);
          } catch {}
        });
      }
    } catch (err) {
      logger.error({ err }, "messageReactionRemove handler error");
    }
  });
};
