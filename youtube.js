const { google } = require('googleapis');

const searchList = async (youtube, query) => {
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
    return null;
};

const loadYoutubeClient = (ytApiKey) => {
    return google.youtube({ version: 'v3', auth: ytApiKey });
};

module.exports = {
    loadYoutubeClient, searchList
}