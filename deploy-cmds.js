const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');

require('dotenv').config();

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

const processCli = (args) => {
    if (args.length != 3) {
        console.log("usage: " + args[0] + " " + args[1] + " <global|guild>");
        process.exit(1);
    }
    let deploymentKind = args[2];
    if (deploymentKind == "global") {
        return null;
    } else if (deploymentKind == "guild") {
        if (!guildId) {
            console.log("Environment variable GUILD_ID not set!");
            process.exit(1);
        }
    } else {
        console.log("usage: " + args[0] + " " + args[1] + " <global|guild>");
        process.exit(1);
    }
}

processCli(process.argv);

const commands = [
    new SlashCommandBuilder().setName('join').setDescription('Joins your channel to play music.'),
    new SlashCommandBuilder().setName('leave').setDescription('Makes the bot leave it\'s channel.'),
    new SlashCommandBuilder().setName('playlist').setDescription('Shows the current playlist.'),
    new SlashCommandBuilder().setName('skip').setDescription('Skips the currently playing song.'),
    new SlashCommandBuilder().setName('clear').setDescription('Clears the playlist and the current song.'),
    new SlashCommandBuilder().setName('play').setDescription('Adds a song to the playlist.')
        .addStringOption(opt => opt.setName("query").setDescription("The query string for the song to play.").setRequired(true))
        .addNumberOption(opt => opt.setName("volume").setDescription("The volume multiplyer for this song.")),
].map(command => command.toJSON());

const rest = new REST({ version: '9' }).setToken(token);

if (guildId) {
    rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })
        .then(() => console.log('Successfully registered application commands.'))
        .catch(console.error);
} else {
    rest.put(Routes.applicationCommands(clientId), { body: commands })
        .then(() => console.log('Successfully registered application commands.'))
        .catch(console.error);
}