import {
  ChatInputCommandInteraction,
  InteractionReplyOptions,
  InteractionResponse,
} from "discord.js";

export const safeEphemeralReply = async (
  interaction: ChatInputCommandInteraction,
  options: InteractionReplyOptions,
): Promise<InteractionResponse | void> => {
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ ...options, ephemeral: true });
      return;
    }
    return await interaction.reply({ ...options, ephemeral: true });
  } catch {
    // swallow; interaction may be expired
  }
};
