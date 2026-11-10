import re
import sys

from youtube_transcript_api import YouTubeTranscriptApi

LANGS = ["en", "en-IN", "en-US", "en-GB"]
WINDOW_SECONDS = 40
MIN_SCORE = 0.6

STOPWORDS = {
    "the", "and", "for", "with", "from", "that", "this", "its", "are",
    "was", "were", "what", "how", "why", "when", "into", "using", "use",
    "their", "your", "our", "than", "then", "also", "can", "will",
}


def _keywords(title: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", (title or "").lower())
    seen = []
    for w in words:
        if len(w) >= 3 and w not in STOPWORDS and w not in seen:
            seen.append(w)
    return seen


def _fetch_segments(video_id: str) -> list[tuple[float, str]]:
    """Transcript ke (start_second, text) tukde. Na mile to khali list."""
    try:
        if hasattr(YouTubeTranscriptApi, "get_transcript"):
            data = YouTubeTranscriptApi.get_transcript(video_id, languages=LANGS)
            return [(float(d["start"]), d["text"]) for d in data]
        data = YouTubeTranscriptApi().fetch(video_id, languages=LANGS)
        return [(float(s.start), s.text) for s in data]
    except Exception:
        return []


def _word_matches(keyword: str, token: str) -> bool:
    if token == keyword:
        return True
    # chhota sa stem match: "modeling" ~ "modelling", "models" ~ "model"
    return len(keyword) >= 6 and token.startswith(keyword[:5])


def find_start_seconds(video_id: str, topic_title: str):
    """Topic jahan sach mein bola gaya ho wo second. Match na mile to None."""
    keywords = _keywords(topic_title)
    if not keywords:
        return None

    segments = _fetch_segments(video_id)
    if not segments:
        return None

    best_score = 0.0
    best_start = None

    for i, (start, _) in enumerate(segments):
        tokens = set()
        for s, text in segments[i:]:
            if s - start > WINDOW_SECONDS:
                break
            tokens.update(re.findall(r"[a-z0-9]+", text.lower()))

        matched = sum(1 for k in keywords if any(_word_matches(k, t) for t in tokens))
        score = matched / len(keywords)
        if matched >= min(2, len(keywords)) and score > best_score:
            best_score = score
            best_start = start

    if best_start is None or best_score < MIN_SCORE:
        return None
    return max(0, int(best_start) - 3)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print('Use: python transcript.py VIDEO_ID "topic title"')
        sys.exit(1)
    result = find_start_seconds(sys.argv[1], sys.argv[2])
    print("start_seconds:", result)