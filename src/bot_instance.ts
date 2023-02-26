import { getVoiceConnection, joinVoiceChannel, VoiceConnection, VoiceConnectionStatus } from "@discordjs/voice";
import { CacheType, CommandInteraction, GuildMember } from "discord.js";
import { logger } from "./log";
import { loadYoutubeClient, searchList } from "./youtube";
import { promisify } from 'util';
import { exec } from "child_process";
import { basename } from "path";

const asyncExec = promisify(exec);
const ytToken = process.env.YT_API_KEY as string;
const youtube = loadYoutubeClient(ytToken);

interface StreamInformation {
    streamUrl: URL,
    duration?: number,
    title: string,
    creator?: string,
    thumb?: URL,
    volume: number
}


const getYoutubeStream = async (video: URL): Promise<{ streamUrl: URL, duration: number } | undefined> => {
    let result = await asyncExec("./yt-dlp --dump-json " + video.toString());
    let { stdout } = result;
    let info = JSON.parse(stdout);
    const durationSecs = info.duration;
    for (let format of info.requested_formats) {
        if (format.width == null && format.height == null) {
            return { duration: durationSecs, streamUrl: new URL(format.url) };
        }
    }
    return;
};

async function obtainStreamInformation(query: string): Promise<StreamInformation | undefined> {
    try {
        const url = new URL(query);
        if (url.hostname.match(".*youtube\\.com") || url.hostname.match(".*youtu\\.be")) {
            const video = await searchList(youtube, url.toString());
            const stream = await getYoutubeStream(url);
            if (!stream) return;
            return {
                streamUrl: stream.streamUrl,
                duration: stream.duration,
                creator: video?.creator,
                thumb: video?.thumb,
                title: video?.title ?? url.toString(),
                volume: 1,
            };
        } else {
            const streamPath: string = url.pathname;
            const filename = basename(streamPath);
            if (filename.endsWith(".mp3") || filename.endsWith(".wav") || filename.endsWith(".ogg")) {
                return {
                    streamUrl: url,
                    title: filename,
                    volume: 1
                }
            }
            return;
        }
    } catch (error) {
        const video = await searchList(youtube, query);
        if (!video) {
            return;
        }
        const stream = await getYoutubeStream(new URL("https://www.youtube.com/watch?v=" + video.videoId));
        if (!stream) return;
        return {
            streamUrl: stream.streamUrl,
            duration: stream.duration,
            creator: video?.creator,
            thumb: video?.thumb,
            title: video?.title ?? query,
            volume: 1,
        };
    }
}

class BotInstance {
    guildId: string;
    connection: VoiceConnection | undefined;

    async checkConnected(): Promise<boolean> {
        this.connection = await getVoiceConnection(this.guildId);
        return this.connection?.state?.status === VoiceConnectionStatus.Ready;
    }

    async enqueueStream(stream: StreamInformation) {
        logger.info("Adding new stream to queue: " + JSON.stringify(stream));
        // TODO: add stream to playlist, pick next stream from list and play it if not currently playing.
    }

    getStreamMessage(stream: StreamInformation): string {
        const creatorString = stream.creator ? `by "${stream.creator}" ` : "";
        if (stream.volume == 1) {
            return `Added "${stream.title}" ${creatorString}to the Playlist! :notes:`;
        } else {
            return `Added "${stream.title}" ${creatorString}at ${stream.volume}x volume to the Playlist! :notes:`;
        }
    }

    async join(interaction: CommandInteraction<CacheType>) {
        let member = await (interaction.member as GuildMember).fetch();
        let voiceChannel = member.voice.channel;

        if (voiceChannel) {
            let voiceChannelId = voiceChannel.id;
            let connection = await joinVoiceChannel({
                channelId: voiceChannelId,
                guildId: this.guildId,
                adapterCreator: interaction.guild?.voiceAdapterCreator as any
            });
            if (connection) {
                this.connection = connection;
                logger.info("Joining voice...");
                connection.on(VoiceConnectionStatus.Ready, async () => {
                    logger.info("Voice ready!");
                });
                await interaction.reply('Joined your channel!');
            } else {
                await interaction.reply('Couldn\'t join your channel :pensive:');
            }
        } else {
            await interaction.reply('You must be in a voice channel to use this command!');
        }
    }
    async leave(interaction: any) {
        this.connection?.disconnect();
        await interaction.reply("Goodbye!");
    }
    async play(interaction: any) {
        if (!await this.checkConnected()) {
            interaction.reply("Currently not connected to voice.");
            return;
        }
        await interaction.deferReply();
        const query: string | undefined = interaction.options.getString("query");
        const volume: number = interaction.options.getNumber("volume") ?? 1;
        if (!query) {
            interaction.editReply("No query... :angry:");
            return;
        }
        const streamInformation = await obtainStreamInformation(query);
        if (!streamInformation) {
            interaction.editReply("Invalid URL, file type or YouTube Query! :unamused:");
            return;
        }
        const message = this.getStreamMessage(streamInformation);
        if (streamInformation.thumb) {
            await interaction.editReply({ content: message, files: [streamInformation.thumb] });
        } else {
            interaction.editReply(message);
        }
        this.enqueueStream({ ...streamInformation, volume });
    }
    playlist(interaction: any) {
        throw new Error("Method not implemented.");
    }
    skip(interaction: any) {
        throw new Error("Method not implemented.");
    }
    clear(interaction: any) {
        throw new Error("Method not implemented.");
    }

    constructor(guildId: string) {
        this.guildId = guildId;
    }
}

export {
    BotInstance
};