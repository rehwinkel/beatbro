// Require the necessary discord.js classes
const { Client, Intents } = require('discord.js');
const { token } = require('./config.json');

// Create a new client instance
const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

// When the client is ready, run this code (only once)
client.once('ready', () => {
    console.log('Ready!');
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    console.log(interaction);
    const { commandName } = interaction;

    if (commandName === 'global') {
        await interaction.reply('Pong!');
    } else if (commandName === 'cmd') {
        await interaction.reply('Server info.');
    } else if (commandName === 'test') {
        await interaction.reply('User info.');
    }
});

// Login to Discord with your client's token
client.login(token);