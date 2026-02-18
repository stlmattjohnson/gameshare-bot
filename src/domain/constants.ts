export const CustomIds = {
  // Admin UX
  AdminConfigureOpen: "admin_cfg_open",
  AdminConfigureSearch: "admin_cfg_search",
  AdminConfigurePrev: "admin_cfg_prev",
  AdminConfigureNext: "admin_cfg_next",
  AdminConfigureToggleSelect: "admin_cfg_toggle_select",
  AdminConfigureToggleButton: "admin_cfg_toggle_button",
  AdminConfigureDone: "admin_cfg_done",
  AdminConfigureDeleteRolesToggle: "admin_cfg_delete_roles_toggle",
  AdminConfigureDeleteRolesConfirm: "admin_cfg_delete_roles_confirm",

  // User roles UX
  UserRolesOpen: "user_roles_open",
  UserRolesPrev: "user_roles_prev",
  UserRolesNext: "user_roles_next",
  UserRolesPickSelect: "user_roles_pick_select",
  UserRolesClearAll: "user_roles_clear_all",

  // DM share flow
  DmShareYes: "dm_share_yes",
  DmShareNo: "dm_share_no",
  DmShareNeverGame: "dm_share_never_game",
  DmDetailPick: "dm_detail_pick",
  DmModalSteam: "dm_modal_steam",
  DmModalServerName: "dm_modal_server_name",
  DmModalServerIp: "dm_modal_server_ip",
  DmConfirmPost: "dm_confirm_post",
  DmCancelPost: "dm_cancel_post",

  // Unknown-game request buttons (DM)
  UnknownRequestAdd: "unknown_req_add",
  UnknownNotNow: "unknown_not_now",

  // Admin review requests UI
  AdminRequestsOpen: "admin_requests_open",
  AdminRequestsPrev: "admin_requests_prev",
  AdminRequestsNext: "admin_requests_next",
  AdminRequestsDone: "admin_requests_done",
  AdminRequestsApprove: "admin_requests_approve",
  AdminRequestsReject: "admin_requests_reject",
} as const;

export const PageSize = {
  AdminGames: 15,
  UserGames: 20,
} as const;

export const Limits = {
  SelectMaxOptions: 25,
  EmbedFieldMax: 25,
} as const;
