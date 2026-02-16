import { PermissionsBitField } from "discord.js";

export const RequiredBotPermissions = new PermissionsBitField([
  PermissionsBitField.Flags.ViewChannel,
  PermissionsBitField.Flags.SendMessages,
  PermissionsBitField.Flags.ReadMessageHistory,
  PermissionsBitField.Flags.ManageRoles,
  // UseApplicationCommands is handled at OAuth2 scope level; no guild permission bit is needed for it.
]);

export function missingPermissions(have: PermissionsBitField) {
  return RequiredBotPermissions.toArray().filter((p) => !have.has(p));
}
