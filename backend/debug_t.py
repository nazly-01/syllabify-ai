import sys

from youtube_transcript_api import YouTubeTranscriptApi

vid = sys.argv[1]

try:
    if hasattr(YouTubeTranscriptApi, "get_transcript"):
        data = YouTubeTranscriptApi.get_transcript(vid)
        print("OK (old api), segments:", len(data))
        print(data[0])
    else:
        data = YouTubeTranscriptApi().fetch(vid)
        print("OK (new api), segments:", len(data))
except Exception as e:
    print("ERROR TYPE:", type(e).__name__)
    print(str(e)[:700])