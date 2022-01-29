const { SlashCommandBuilder } = require('@discordjs/builders');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { clientId, token } = require('./config.json');

const processCli = (args) => {
    if (args.length < 3) {
        console.log("usage: " + args[0] + " " + args[1] + " <global|guild> [guildId]");
        process.exit(1);
    }
    let deploymentKind = args[2];
    if (deploymentKind == "global") {
        if (args.length != 3) {
            console.log("usage: " + args[0] + " " + args[1] + " global");
            process.exit(1);
        } else {
            return null;
        }
    } else if (deploymentKind == "guild") {
        if (args.length != 4) {
            console.log("usage: " + args[0] + " " + args[1] + " guild <guildId>");
            process.exit(1);
        } else {
            return args[3];
        }
    } else {
        console.log("usage: " + args[0] + " " + args[1] + " <global|guild> [guildId]");
        process.exit(1);
    }
}

let guildId = processCli(process.argv);

const commands = [
        new SlashCommandBuilder().setName('global').setDescription('Replies with pong!'),
        new SlashCommandBuilder().setName('cmd').setDescription('Replies with server info!'),
        new SlashCommandBuilder().setName('test').setDescription('Replies with user info!'),
    ]
    .map(command => command.toJSON());

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