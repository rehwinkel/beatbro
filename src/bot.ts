import { config as dotenvConfig } from 'dotenv';
dotenvConfig();
const token = process.env.BOT_TOKEN;

import { BotInstance } from "./bot_instance";
import { Client } from "discord.js";
import { logger } from "./log";
import { GatewayIntentBits } from 'discord-api-types/v9';

const client = new Client({
    intents: GatewayIntentBits.Guilds
        | GatewayIntentBits.GuildVoiceStates
});

client.once('ready', () => {
    logger.info("Bot ready!");
});

const bots = new Map<string, BotInstance>();

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;
    const guildId = interaction.guild?.id;

    let instance: BotInstance;
    if (guildId) {
        let maybe_instance = bots.get(guildId);
        if (!maybe_instance) {
            instance = new BotInstance(guildId);
            bots.set(guildId, instance);
        } else {
            instance = maybe_instance;
        }
    } else {
        interaction.reply("Whatever you tried to do won't work!");
        return;
    }

    if (commandName === 'join') {
        instance.join(interaction);
    } else if (commandName === 'leave') {
        instance.leave(interaction);
    } else if (commandName === 'play') {
        instance.play(interaction);
    } else if (commandName === 'playlist') {
        instance.playlist(interaction);
    } else if (commandName === 'skip') {
        instance.skip(interaction);
    } else if (commandName === 'clear') {
        instance.clear(interaction);
    }
});

logger.info("Logging in client...");
client.login(token);
