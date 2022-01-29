const { searchList, loadYoutubeClient } = require('./youtube.js');
const { Client, Intents } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus, createAudioPlayer, createAudioResource, NoSubscriberBehavior, AudioPlayerStatus } = require('@discordjs/voice');
const { createLogger, format } = require('winston');
const { Console } = require('winston/lib/winston/transports');
const { createClient } = require('redis');
const { exec } = require("child_process");
const { promisify } = require('util');
const he = require("he");
const exitHook = require('async-exit-hook');

const asyncExec = promisify(exec);
require('dotenv').config();

const connectDatabase = () => {
    const client = createClient();
    client.on('error', (err) => console.log('Redis Client Error', err));
    client.connect().then(() => logger.info("Database connected!"));
    return client;
};

const token = process.env.BOT_TOKEN;
const ytToken = process.env.YT_API_KEY;

const logger = createLogger({
    levels: {
        error: 0,
        warn: 1,
        info: 2
    },
    format: format.combine(
        format.timestamp(),
        format.align(),
        format.colorize(),
        format.printf(info => `[${info.timestamp}] [${info.level}] ${info.message}`),
    ),
    transports: [new Console()]
});

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_VOICE_STATES] });
const youtube = loadYoutubeClient(ytToken);
const db = connectDatabase();

exitHook(cb => {
    logger.info("Closing...");
    db.flushAll().then(() => {
        logger.info("Flushed DB");
        cb();
    })
});

client.once('ready', () => {
    logger.info("Bot ready!");
});

const getYoutubeStream = async (videoId) => {
    let result = await asyncExec("./youtube-dl --dump-json https://www.youtube.com/watch?v=" + videoId);
    let { stdout } = result;
    let info = JSON.parse(stdout);
    const durationSecs = info.duration;
    for (let format of info.requested_formats) {
        if (format.width == null && format.height == null) {
            return { duration: durationSecs, url: format.url };
        }
    }
    return null;
};

const playNextVideo = async (guildId, force) => {
    logger.info("Playing next video");
    let current = await currentlyPlaying(guildId);
    if (!current || force) {
        const connection = getVoiceConnection(guildId);
        if (connection) {
            let video = await nextFromPlaylist(guildId);
            await playVideo(guildId, video, connection);
        } else {
            logger.info("Can't play, not connected to voice");
        }
    } else {
        logger.info("Already playing, waiting");
    }
};

const durationString = (durationSecs) => {
    let seconds = durationSecs % 60;
    let minutes = Math.floor(durationSecs / 60) % 60;
    let hours = Math.floor(durationSecs / 3600);
    let secondsStr = seconds < 10 ? ("0" + seconds) : ("" + seconds);
    let minutesStr = seconds < 10 ? ("0" + seconds) : ("" + seconds);
    if (hours > 0) {
        return `${hours}:${minutesStr}:${secondsStr}`;
    } else {
        return `${minutes}:${secondsStr}`;
    }
};

const playVideo = async (guildId, video, connection) => {
    if (video) {
        logger.info("Playing video: " + JSON.stringify(video));
        let channel = await client.channels.fetch(video.channel);
        let message = await channel.messages.fetch(video.msg);
        await updatePlaying(guildId, video);
        await message.reply(`Now playing "${video.title}" by "${video.creator}" [${durationString(video.duration)}]! :notes:`);

        // TODO: start player and update after done
        const audioPlayer = createAudioPlayer({
            behaviors: {
                noSubscriber: NoSubscriberBehavior.Pause,
            },
        });
        const resource = createAudioResource(video.streamUrl);
        audioPlayer.play(resource);
        const subscription = connection.subscribe(audioPlayer);
        audioPlayer.on(AudioPlayerStatus.Idle, async () => {
            logger.info("Player went idle");
            subscription.unsubscribe();
            await updatePlaying(guildId, null);
            await playNextVideo(guildId, false);
        });
    } else {
        logger.info("No video to play");
    }
};

const handleJoin = async (interaction) => {
    let member = await interaction.member.fetch();
    let voiceChannel = member.voice.channel;

    if (voiceChannel) {
        let voiceChannelId = voiceChannel.id;
        let connection = await joinVoiceChannel({
            channelId: voiceChannelId,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator
        });
        if (connection) {
            logger.info("Joining voice");
            connection.on(VoiceConnectionStatus.Ready, async () => {
                logger.info("Voice ready");
                let current = await currentlyPlaying(interaction.guild.id);
                if (!current) {
                    let video = await nextFromPlaylist(interaction.guild.id);
                    await playVideo(interaction.guild.id, video, connection);
                }
            });
            await interaction.reply('Joined your channel!');
        } else {
            await interaction.reply('Couldn\'t join your channel :pensive:');

        }
    }
    else {
        await interaction.reply('You must be in a voice channel to use this command!');
    }
};

const handleLeave = async (interaction) => {
    const connection = getVoiceConnection(interaction.guild.id);
    if (connection) {
        logger.info("Destroying voice");
        connection.destroy();
        await interaction.reply('Left your channel!');
    }
    else {
        await interaction.reply('I\'m currently not in a voice channel, can\'t leave.');
    }
};

const addToPlaylist = async (guildId, video) => {
    await db.rPush("playlist" + guildId, JSON.stringify(video));
};

const getPlaylist = async (guildId) => {
    return await db.lRange("playlist" + guildId, 0, -1);
};

const nextFromPlaylist = async (guildId) => {
    return JSON.parse(await db.lPop("playlist" + guildId));
};

const updatePlaying = async (guildId, video) => {
    if (video) {
        await db.set("playing" + guildId, JSON.stringify(video));
    } else {
        await db.del("playing" + guildId);
    }
};

const currentlyPlaying = async (guildId) => {
    return JSON.parse(await db.get("playing" + guildId));
};

const handlePlay = async (interaction) => {
    const connection = getVoiceConnection(interaction.guild.id);
    if (!connection) {
        await interaction.reply("I have to be in a voice channel for you to request music.");
    } else {
        await interaction.deferReply();
        const query = interaction.options.getString("query");
        let video = await searchList(youtube, query);
        video.title = he.decode(video.title);
        let { duration, url } = await getYoutubeStream(video.videoId);
        video["streamUrl"] = url;
        video["duration"] = duration;
        if (video) {
            let reply = `Added "${video.title}" by "${video.creator}" [${durationString(duration)}] to the Playlist! :notes:`;
            let msg = await interaction.editReply({ content: reply, files: [video.thumb] });
            video["msg"] = msg.id;
            video["channel"] = msg.channelId;
            logger.info("Added video: " + JSON.stringify(video));
            await addToPlaylist(interaction.guild.id, video);
            await playNextVideo(interaction.guild.id, false);
        } else {
            await interaction.editReply('No results found... :anguished:');
        }
    }
};

const handlePlaylist = async (interaction) => {
    let playlist = await getPlaylist(interaction.guild.id);
    let current = await currentlyPlaying(interaction.guild.id);
    let message;
    if (current) {
        message = `Currently playing: "${current.title}" by "${current.creator}" [${durationString(current.duration)}]\n\n`;
    } else {
        message = "Currently not playing!\n\n";
    }

    message += "Upcoming: ";
    if (playlist.length > 0) {
        for (let videoJson of playlist) {
            let video = JSON.parse(videoJson);
            let videoRow = `"${video.title}" by "${video.creator}"`;
            message += "\n- " + videoRow;
        }
    } else {
        message += "Nothing...";
    }
    await interaction.reply(message);
};

const handleSkip = async (interaction) => {
    let current = await currentlyPlaying(interaction.guild.id);
    if (current) {
        interaction.reply("Skipping current song!");
    } else {
        interaction.reply("Can\'t skip, currently not playing.")
    }
    await playNextVideo(interaction.guild.id, true);
};

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'join') {
        handleJoin(interaction);
    } else if (commandName === 'leave') {
        handleLeave(interaction);
    } else if (commandName === 'play') {
        handlePlay(interaction);
    } else if (commandName === 'playlist') {
        handlePlaylist(interaction);
    } else if (commandName === 'skip') {
        handleSkip(interaction);
    }
});

logger.info("Logging in client...");
client.login(token);