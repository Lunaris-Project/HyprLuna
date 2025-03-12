import * as Utils from 'resource:///com/github/Aylur/ags/utils.js';
const BASE_URL = 'https://music.youtube.com/youtubei/v1';
const CLIENT = {
    clientName: 'WEB_REMIX',
    clientVersion: '1.20231212.01.00',
};

class YTMusicAPI {
    constructor() {
        this.headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        };
    }

    async _makeRequest(endpoint, params = {}) {
        try {
            const url = `${BASE_URL}${endpoint}`;
            const response = await Utils.fetch(url, {
                method: 'POST',
                headers: this.headers,
                body: JSON.stringify({
                    ...params,
                    client: CLIENT,
                    context: {
                        client: CLIENT,
                    },
                }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API request failed (${endpoint}):`, error);
            throw error;
        }
    }

    async getTrackInfo(videoId) {
        try {
            const response = await this._makeRequest('/next', {
                videoId,
                isAudioOnly: true,
                params: 'wAEB', // Minimal data parameter
            });

            if (!response?.contents?.singleColumnMusicWatchNextResultsRenderer)
                throw new Error('Invalid response format');

            const data = response.contents.singleColumnMusicWatchNextResultsRenderer
                .tabbedRenderer.watchNextTabbedResultsRenderer.tabs[0].tabRenderer.content;
            
            const track = data?.musicQueueRenderer?.content?.playlistPanelRenderer?.contents?.[0]
                ?.playlistPanelVideoRenderer;

            if (!track) throw new Error('Track not found');
            if (!track.title?.runs?.[0]?.text) throw new Error('Invalid track title');
            if (!track.thumbnail?.thumbnails?.length) throw new Error('Invalid track thumbnail');

            const thumbnails = track.thumbnail.thumbnails;
            const highestQualityThumbnail = thumbnails[thumbnails.length - 1].url;

            return {
                videoId,
                title: track.title.runs[0].text,
                artists: track.longBylineText.runs
                    .filter((run, i) => i % 2 === 0)
                    .map(artist => ({ name: artist.text })),
                thumbnail: highestQualityThumbnail,
                duration: track.lengthText?.runs?.[0]?.text || '0:00',
            };
        } catch (error) {
            console.error('Error fetching track info:', error);
            return { error: error.message };
        }
    }

    async searchSongs(query) {
        try {
            const response = await this._makeRequest('/search', {
                query,
                params: 'EgWKAQIIAWoKEAMQBBAJEAoQBQ%3D%3D', // Filter for songs
            });

            const results = response?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]
                ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
                ?.musicShelfRenderer?.contents || [];

            return results.map(item => {
                const data = item.musicResponsiveListItemRenderer;
                return {
                    videoId: data.playlistItemData.videoId,
                    title: data.flexColumns[0].musicResponsiveListItemFlexColumnRenderer.text.runs[0].text,
                    artists: data.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text.runs
                        .filter((run, i) => i % 2 === 0)
                        .map(artist => ({ name: artist.text })),
                    thumbnail: data.thumbnail.musicThumbnailRenderer.thumbnail.thumbnails.slice(-1)[0].url,
                };
            });
        } catch (error) {
            console.error('Error searching songs:', error);
            return { error: error.message };
        }
    }

    async getTrending() {
        try {
            // Get trending music from explore page
            const response = await this._makeRequest('/browse', {
                params: 'EgWKAQIQAWoKEAMQBBAJEAoQBQ%3D%3D', // Trending music parameter
            });

            const results = response?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]
                ?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
                ?.musicCarouselShelfRenderer?.contents || [];

            return results.map(item => {
                const data = item.musicResponsiveListItemRenderer;
                if (!data) return null;
                
                return {
                    videoId: data.playlistItemData?.videoId,
                    title: data.flexColumns[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text,
                    artists: data.flexColumns[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs
                        ?.filter((run, i) => i % 2 === 0)
                        ?.map(artist => ({ name: artist.text })) || [],
                    thumbnail: data.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url,
                };
            }).filter(Boolean); // Remove any null results
        } catch (error) {
            console.error('Error getting trending music:', error);
            return [];
        }
    }

    async getRadio(videoId, limit = 5) {
        try {
            const response = await this._makeRequest('/next', {
                videoId,
                isAudioOnly: true,
                params: 'wAEB', // Radio parameter
            });

            const playlist = response?.contents?.singleColumnMusicWatchNextResultsRenderer
                ?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer
                ?.content?.musicQueueRenderer?.content?.playlistPanelRenderer?.contents || [];

            return playlist.slice(1, limit + 1).map(item => {
                const track = item.playlistPanelVideoRenderer;
                return {
                    videoId: track.videoId,
                    title: track.title.runs[0].text,
                    artists: track.longBylineText.runs
                        .filter((run, i) => i % 2 === 0)
                        .map(artist => ({ name: artist.text })),
                    thumbnail: track.thumbnail.thumbnails.slice(-1)[0].url,
                };
            });
        } catch (error) {
            console.error('Error getting radio:', error);
            return { error: error.message };
        }
    }
}

export default new YTMusicAPI();
