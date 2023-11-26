import { google } from 'googleapis';

interface Video {
    videoId: string,
    title: string,
    creator: string,
    thumb: URL,
}

const searchList = async (youtube, query: string): Promise<Video | undefined> => {
    const result = await youtube.search.list({
        "part": [
            "snippet"
        ],
        "maxResults": 1,
        "safeSearch": "none",
        "type": "video",
        "q": query
    });
    let videos = result.data.items;
    if (videos.length > 0) {
        let video = videos[0];
        let videoId = video.id.videoId;
        let title = video.snippet.title;
        let creator = video.snippet.channelTitle;
        let thumb = video.snippet.thumbnails.medium.url;
        return { videoId, title, creator, thumb };
    }
    return undefined;
};

const loadYoutubeClient = (ytApiKey: string) => {
    return google.youtube({ version: 'v3', auth: ytApiKey });
};

export {
    loadYoutubeClient, searchList
}