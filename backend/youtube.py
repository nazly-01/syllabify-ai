import html
import os
import re
import sys

import requests
from dotenv import load_dotenv

load_dotenv()

SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos"

# Is se chhota video = dedicated topic video, isse bada = full lecture
DEDICATED_MAX_SECONDS = 25 * 60
MIN_SECONDS = 60  # Shorts jaise bahut chhote videos hata do


class YouTubeError(Exception):
    """User ko dikhane layak saaf error message."""


def _api_key() -> str:
    key = os.getenv("YOUTUBE_API_KEY", "").strip()
    if not key or key == "PASTE_YOUR_KEY_HERE":
        raise YouTubeError(
            "YouTube API key set nahi hai. backend/.env mein "
            "YOUTUBE_API_KEY daalo aur server restart karo."
        )
    return key


def _get(url: str, params: dict) -> dict:
    try:
        r = requests.get(url, params=params, timeout=15)
    except requests.RequestException:
        raise YouTubeError("YouTube se connect nahi ho paaya. Internet check karo.")

    if r.status_code == 200:
        return r.json()

    try:
        err = r.json().get("error", {})
        reason = (err.get("errors") or [{}])[0].get("reason", "")
        message = err.get("message", "")
    except ValueError:
        reason, message = "", r.text[:200]

    if reason in ("quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"):
        raise YouTubeError(
            "YouTube API ka aaj ka quota khatam ho gaya. Kal try karo."
        )
    if reason in ("keyInvalid", "API_KEY_INVALID") or "API key not valid" in message:
        raise YouTubeError("YouTube API key galat hai. .env check karo.")
    if "has not been used" in message or reason == "accessNotConfigured":
        raise YouTubeError(
            "Google Cloud mein YouTube Data API v3 enable nahi hai."
        )
    raise YouTubeError(f"YouTube API error ({r.status_code}): {message or reason}")


def _parse_duration(iso: str) -> int:
    """'PT1H2M3S' -> seconds."""
    m = re.fullmatch(r"P(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", iso or "")
    if not m:
        return 0
    h, mi, s = (int(x) if x else 0 for x in m.groups())
    return h * 3600 + mi * 60 + s


def search_videos(query: str, max_results: int = 10) -> list[dict]:
    key = _api_key()

    data = _get(
        SEARCH_URL,
        {
            "key": key,
            "part": "snippet",
            "type": "video",
            "q": query,
            "maxResults": max_results,
            "relevanceLanguage": "en",
            "safeSearch": "strict",
            "videoEmbeddable": "true",
        },
    )
    items = data.get("items", [])
    ids = [i["id"]["videoId"] for i in items if i.get("id", {}).get("videoId")]
    if not ids:
        return []

    # Duration ke liye alag call (sirf 1 quota unit)
    details = _get(
        VIDEOS_URL,
        {"key": key, "part": "contentDetails", "id": ",".join(ids)},
    )
    durations = {
        v["id"]: _parse_duration(v["contentDetails"].get("duration", ""))
        for v in details.get("items", [])
    }

    videos = []
    for i in items:
        vid = i.get("id", {}).get("videoId")
        if not vid or vid not in durations:
            continue
        secs = durations[vid]
        if secs < MIN_SECONDS:
            continue
        sn = i["snippet"]
        thumbs = sn.get("thumbnails", {})
        thumb = (thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}).get("url", "")
        videos.append(
            {
                "video_id": vid,
                "title": html.unescape(sn.get("title", "")),
                "channel": html.unescape(sn.get("channelTitle", "")),
                "thumbnail": thumb,
                "url": f"https://www.youtube.com/watch?v={vid}",
                "duration_seconds": secs,
                "kind": "dedicated" if secs <= DEDICATED_MAX_SECONDS else "full_lecture",
            }
        )
    return videos


def find_resources(topic: str, subject: str = "", limit: int = 3) -> list[dict]:
    """Topic ke liye max `limit` videos: pehle dedicated, phir ek full lecture."""
    subject = re.sub(r"\(.*?\)", "", subject or "").replace("Untitled Subject", "").strip()
    query = f"{topic} {subject}".strip()

    videos = search_videos(query, max_results=10)
    dedicated = [v for v in videos if v["kind"] == "dedicated"]
    lectures = [v for v in videos if v["kind"] == "full_lecture"]

    picked = dedicated[: max(limit - 1, 1)] + lectures[:1]
    # Kam pad jaye to bache hue videos se bhar do
    for v in videos:
        if len(picked) >= limit:
            break
        if v not in picked:
            picked.append(v)
    return picked[:limit]


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print('Use: python youtube.py "topic" ["subject"]')
        sys.exit(1)

    topic = sys.argv[1]
    subject = sys.argv[2] if len(sys.argv) > 2 else ""
    try:
        results = find_resources(topic, subject)
    except YouTubeError as e:
        print("ERROR:", e)
        sys.exit(1)

    if not results:
        print("Koi video nahi mila.")
    for v in results:
        mins = v["duration_seconds"] // 60
        print(f"[{v['kind']}] {v['title']}  |  {v['channel']}  |  {mins} min")
        print("   ", v["url"])