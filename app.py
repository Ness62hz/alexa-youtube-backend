from flask import Flask, request, jsonify
import yt_dlp

app = Flask(__name__)


@app.get("/")
def home():
    return jsonify({
        "status": "ok",
        "service": "Alexa YouTube Backend"
    })


@app.get("/health")
def health():
    return jsonify({
        "status": "ok"
    })


@app.get("/play")
def play():

    query = request.args.get("q", "").strip()

    if not query:
        return jsonify({
            "success": False,
            "error": "Missing query parameter q"
        }), 400

    print("PLAY REQUEST:", query)

    ydl_options = {
        "quiet": True,
        "no_warnings": True,
        "format": "bestaudio[ext=m4a]/bestaudio/best",
        "noplaylist": True,
        "skip_download": True
    }

    try:

        with yt_dlp.YoutubeDL(ydl_options) as ydl:

            info = ydl.extract_info(
                "ytsearch1:" + query,
                download=False
            )

            if not info:
                raise Exception("No result returned")

            entries = info.get("entries")

            if not entries:
                raise Exception("No videos found")

            video = entries[0]

            if not video:
                raise Exception("Invalid video result")

            video_id = video.get("id")
            title = video.get("title", "Unknown song")
            audio_url = video.get("url")

            if not audio_url:

                formats = video.get("formats", [])

                audio_formats = [
                    f for f in formats
                    if f.get("acodec") != "none"
                    and f.get("vcodec") == "none"
                    and f.get("url")
                ]

                if not audio_formats:
                    raise Exception(
                        "No compatible audio stream found"
                    )

                audio_formats.sort(
                    key=lambda f: (
                        f.get("abr") or 0
                    ),
                    reverse=True
                )

                audio_url = audio_formats[0]["url"]

            print(
                "FOUND:",
                title,
                video_id
            )

            return jsonify({
                "success": True,
                "title": title,
                "videoId": video_id,
                "audioUrl": audio_url
            })

    except Exception as error:

        print(
            "PLAY ERROR:",
            str(error)
        )

        return jsonify({
            "success": False,
            "error": str(error)
        }), 500
