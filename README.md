# GameShare Discord Bot (TypeScript + discord.js v14 + Prisma + SQLite)

A production-ready bot that:
- Lets admins enable/disable games from a large catalog (search + pagination).
- Creates/maintains a role per enabled game.
- Lets users opt in and select which enabled game roles they want.
- Detects when opted-in users start playing an enabled game.
- DMs the user to confirm sharing, optionally with details, and posts to an announce channel tagging the game role.

## Requirements
- Node.js 20+
- A Discord application + bot token
- Prisma uses SQLite by default

## Discord Developer Portal setup
1. Create an application and add a Bot.
2. Copy:
   - Bot Token → `DISCORD_TOKEN`
   - Application ID → `DISCORD_APPLICATION_ID`
3. Enable Presence Intent:
   - Bot → Privileged Gateway Intents → **Presence Intent** = ON
   - (This is required for game detection.)
4. Invite the bot with required permissions.

### Required Gateway Intents
- Guilds
- GuildPresences (required)
- DirectMessages

### Required Bot Permissions
- Manage Roles
- Send Messages
- Read Message History (optional but used in some flows)
- View Channels

**Permissions integer** used by this repo: `2415987712`

Invite URL format:
`https://discord.com/api/oauth2/authorize?client_id=APP_ID&permissions=2415987712&scope=bot%20applications.commands`

(Or run `npm run invite` after setting `DISCORD_APPLICATION_ID`.)

## Setup
```bash
cp .env.example .env
# Fill DISCORD_TOKEN and DISCORD_APPLICATION_ID
npm install
npm run prisma:migrate
npm run commands:register
npm run dev
