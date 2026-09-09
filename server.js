import express from 'express';
import { Innertube } from 'youtubei.js';

const app = express();

const PORT = process.env.PORT || 10000;

let youtube = null;
let youtubePromise = null;


// =====================================================
// INITIALIZE YOUTUBE
// =====================================================

async function getYouTube() {

    if (youtube) {
        return youtube;
    }

    if (!youtubePromise) {

        console.log('Initializing YouTube.js...');

        youtubePromise = Innertube.create({
            lang: 'en',
            location: 'US',
            generate_session_locally: true
        })
        .then(instance => {

            youtube = instance;

            console.log(
                'YouTube.js initialized successfully'
            );

            return youtube;
        })
        .catch(error => {

            youtubePromise = null;

            console.error(
                'YouTube initialization error:',
                error
            );

            throw error;
        });
    }

    return youtubePromise;
}


// =====================================================
// TITLE HELPER
// =====================================================

function getTitle(video) {

    if (!video) {
        return 'Unknown song';
    }

    if (typeof video.title === 'string') {
        return video.title;
    }

    if (
        video.title &&
        typeof video.title.text === 'string'
    ) {
        return video.title.text;
    }

    if (
        video.title &&
        typeof video.title.toString === 'function'
    ) {
        return video.title.toString();
    }

    return 'Unknown song';
}


// =====================================================
// SEARCH
// =====================================================

async function searchVideo(query) {

    const yt = await getYouTube();

    console.log(
        'Searching:',
        query
    );

    const results = await yt.search(query, {
        type: 'video'
    });

    if (
        !results ||
        !results.videos ||
        results.videos.length === 0
    ) {
        throw new Error(
            'No videos found'
        );
    }

    const video = results.videos[0];

    const videoId =
        video.id ||
        video.video_id ||
        video.videoId;

    if (!videoId) {
        throw new Error(
            'Video result has no ID'
        );
    }

    return {
        videoId: videoId,
        title: getTitle(video)
    };
}


// =====================================================
// GET STREAM URL
// =====================================================

async function getAudioUrl(videoId) {

    const yt = await getYouTube();

    console.log(
        'Getting audio for:',
        videoId
    );

    let format;

    try {

        format = await yt.getStreamingData(
            videoId,
            {
                type: 'audio',
                quality: 'best',
                format: 'mp4'
            }
        );

    } catch (error) {

        console.log(
            'MP4 failed, trying generic audio'
        );

        format = await yt.getStreamingData(
            videoId,
            {
                type: 'audio',
                quality: 'best'
            }
        );
    }

    if (!format) {
        throw new Error(
            'No audio format available'
        );
    }

    if (!format.url) {
        throw new Error(
            'Audio format has no URL'
        );
    }

    console.log(
        'Audio URL generated'
    );

    return String(format.url);
}


// =====================================================
// HEALTH
// =====================================================

app.get('/', (req, res) => {

    res.json({
        status: 'ok',
        service: 'Alexa YouTube Backend'
    });
});


app.get('/health', (req, res) => {

    res.json({
        status: 'ok'
    });
});


// =====================================================
// PLAY ENDPOINT
// =====================================================

app.get('/play', async (req, res) => {

    const query =
        String(req.query.q || '').trim();

    if (!query) {

        return res.status(400).json({
            error: 'Missing query parameter q'
        });
    }

    console.log(
        '================================'
    );

    console.log(
        'PLAY REQUEST:',
        query
    );

    console.log(
        '================================'
    );

    try {

        const video =
            await searchVideo(query);

        console.log(
            'FOUND:',
            video.title,
            video.videoId
        );

        const audioUrl =
            await getAudioUrl(
                video.videoId
            );

        return res.json({
            success: true,
            title: video.title,
            videoId: video.videoId,
            audioUrl: audioUrl
        });

    } catch (error) {

        console.error(
            'PLAY REQUEST ERROR:',
            error
        );

        return res.status(500).json({
            success: false,
            error:
                error &&
                error.message
                    ? error.message
                    : 'Unknown error'
        });
    }
});


// =====================================================
// START SERVER
// =====================================================

app.listen(
    PORT,
    '0.0.0.0',
    () => {

        console.log(
            `Server listening on port ${PORT}`
        );

        /*
         * Warm up YouTube.js after server starts.
         * The HTTP server becomes available immediately,
         * then YouTube initializes in the background.
         */

        getYouTube()
            .then(() => {
                console.log(
                    'YouTube warm-up complete'
                );
            })
            .catch(error => {
                console.error(
                    'YouTube warm-up failed:',
                    error
                );
            });
    }
);
