# GameShare Discord Bot (TypeScript + discord.js + Prisma + SQLite)

GameShare helps communities announce when members start playing games and lets other users opt in/out of game-specific roles.

Core features:

- Admin UI to enable/disable games from a large static catalog or server-specific custom games.
- Automatic creation and maintenance of a role per enabled game.
- Opt-in presence monitoring per user and per-server.
- Single-message DM flow: the bot edits a single DM as the user moves through the share flow (prompt → details → preview → confirm/cancel).
- Robust announce posts that include a role mention and reaction buttons so members can add/remove the role by reacting.
- Persistent session state in the database so posted announcements and active sessions survive restarts.
- Presence-driven lifecycle: when a user stops playing the game the session is marked inactive and the announce message is updated to past tense and reactions are removed.
- Admin/user command: `/gameshare sessions` — lists active sessions grouped by game (ephemeral, formatted with separators).

## Requirements

- Node.js 20+
- A Discord application + bot token
- Prisma (configured to use SQLite by default in this repo)

## Discord Developer Portal setup

1. Create an application and add a Bot.
2. Copy:
   - Bot Token → `DISCORD_TOKEN`
   - Application ID → `DISCORD_APPLICATION_ID`
3. Enable privileged intents in the Developer Portal where indicated:
   - Bot → Privileged Gateway Intents → **Presence Intent** = ON
   - Bot → Privileged Gateway Intents → **Server Members Intent** = ON
4. Invite the bot with the appropriate permissions (see below).

### Gateway Intents required by the bot

- Guilds
- Guild Presences (for detecting Playing presence)
- Guild Members (to resolve member display names and manage roles)
- Guild Message Reactions (to receive reaction add/remove events)
- Direct Messages (for DM flows)

Additionally the bot code uses partials for resilient reaction handling; ensure your client enables partials for `Message`, `Reaction`, and `User`.

### Bot permissions

The bot must be granted the following permissions in the guild (or be given a role with these permissions):

- Manage Roles (required to add/remove game roles)
- Manage Messages (required for removing user reactions when needed)
- Add Reactions (to add the opt-in/opt-out emoji to announce posts)
- Send Messages (to post announcements)
- View Channels (to access the announce channel)
- Read Message History (used in some flows)

Note: role hierarchy still applies — the bot's highest role must be above the game roles it manages.

If you use the provided invite helper, confirm the permissions integer includes `Manage Messages` and `Add Reactions` in addition to `Manage Roles` and standard messaging perms.

## Setup

```bash
cp [.env.example](http://_vscodecontentref_/1) .env
# Fill DISCORD_TOKEN and DISCORD_APPLICATION_ID
npm install
npm run prisma:migrate
npm run commands:register
npm run dev
```
