export type DetailKind = "NONE" | "STEAM" | "SERVER_NAME" | "SERVER_IP";

export type Share = {
  guildId: string;
  userId: string;
  gameId: string;
  gameName: string;
  detailKind: DetailKind;
  detailValue?: string;
};
