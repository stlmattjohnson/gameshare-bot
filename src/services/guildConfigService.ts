import { guildConfigRepo } from "../db/repositories/guildConfigRepo.ts";
import { enabledGameRepo } from "../db/repositories/enabledGameRepo.ts";
import { gameRoleMapRepo } from "../db/repositories/gameRoleMapRepo.ts";

export const guildConfigService = {
  getOrCreate: guildConfigRepo.getOrCreate,
  setAnnounceChannel: guildConfigRepo.setAnnounceChannel,
  setRequestChannel: guildConfigRepo.setRequestChannel, // NEW
  setDeleteDisabledRoles: guildConfigRepo.setDeleteDisabledRoles,
  listEnabledGameIds: enabledGameRepo.listEnabledGameIds,
  enableGame: enabledGameRepo.enable,
  disableGame: enabledGameRepo.disable,
  isEnabled: enabledGameRepo.isEnabled,
  getRoleId: gameRoleMapRepo.getRoleId,
  setRoleId: gameRoleMapRepo.setRoleId,
  listMappings: gameRoleMapRepo.listMappings,
};
