import re
import sys

SSC_RE = re.compile(r"^self[- ]?study component\s*(\(\s*ssc\s*\))?\s*:?\s*", re.I)
TEMPLATE_RE = re.compile(r"MKV-TEMPLATE.*?\(\d{1,2}\.\d{1,2}\.\d{4}\)\s*", re.I)
LEAD_JUNK_RE = re.compile(r"^(and|or)\s+", re.I)
YEAR_PREFIX_RE = re.compile(r"^\d{4}\s*[-–—]\s*")
NUM_PREFIX_RE = re.compile(r"^\d{1,2}[\.\)]\s+")
SENTENCE_RE = re.compile(r"(?<=[a-z\)\]])\.\s+(?=[A-Z])")

GENERIC = {"types", "type", "etc", "others", "other", "and", "or", "the"}
CONNECTORS = {
    "and", "or", "of", "the", "to", "for", "in", "with", "on",
    "&", "a", "an", "by", "using", "as", "from",
}

TOPIC_MAX = 100
EXP_MAX = 140


def _shorten(t: str, limit: int) -> str:
    t = t.strip()
    if len(t) > limit:
        t = t[:limit].rsplit(" ", 1)[0]
    return t


def _group_lines(lines: list[str]) -> list[str]:
    """Sirf wrapped lines jodta hai, baaki alag rakhta hai."""
    chunks: list[str] = []
    for ln in lines:
        if chunks:
            prev = chunks[-1]
            last_word = prev.split()[-1].lower().strip(",:;")
            if (
                prev.endswith((",", "-", "–", "/"))
                or last_word in CONNECTORS
                or ln[0].islower()
            ):
                chunks[-1] = prev + " " + ln
                continue
        chunks.append(ln)
    return chunks


def _split_top_level(text: str, seps: str) -> list[str]:
    """Brackets ke andar nahi todta (agar brackets balanced hon)."""
    protect = text.count("(") == text.count(")") and text.count("[") == text.count("]")
    parts, buf, depth = [], [], 0
    for ch in text:
        if protect:
            if ch in "([":
                depth += 1
            elif ch in ")]":
                depth = max(0, depth - 1)
        if ch in seps and depth == 0:
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    parts.append("".join(buf))
    return parts


def clean_topics(raw_lines: list[str]) -> list[str]:
    lines = []
    for ln in raw_lines:
        ln = TEMPLATE_RE.sub("", ln)
        ln = SSC_RE.sub("", ln.strip())
        ln = re.sub(r"\s+", " ", ln).strip()
        if ln:
            lines.append(ln)

    topics, seen = [], set()
    for chunk in _group_lines(lines):
        for sentence in SENTENCE_RE.split(chunk):
            for piece in _split_top_level(sentence, ",;:•"):
                t = piece.strip(" .-–—•●▪➢")
                t = LEAD_JUNK_RE.sub("", t)
                t = YEAR_PREFIX_RE.sub("", t)
                t = NUM_PREFIX_RE.sub("", t).strip(" .-–—")

                if sum(c.isalpha() for c in t) < 4:
                    continue
                if t.lower() in GENERIC:
                    continue

                t = _shorten(t, TOPIC_MAX)
                key = t.lower()
                if key in seen:
                    continue
                seen.add(key)
                topics.append(t)
    return topics


def split_experiments(experiments: list[dict]) -> list[str]:
    """Chipke hue experiments ko '2 Implement...' number pe todta hai."""
    pieces = []
    for e in experiments:
        name = (e.get("experiment_name") or "").strip()
        for p in re.split(r"\s+(?=\d{1,2}\s+[A-Z])", name):
            p = re.sub(r"^\d{1,2}\s+", "", p.strip()).strip(" :.-–—")
            if len(p) >= 5:
                pieces.append(p)

    return [
        f"Experiment {i}: {_shorten(p, EXP_MAX)}"
        for i, p in enumerate(pieces, 1)
    ]


def build_units(item: dict) -> list[tuple[str, list[str]]]:
    """Extractor ke item se [(unit_title, [topics])] banata hai."""
    result = []

    for u in item.get("units") or []:
        topics = clean_topics(u.get("topics", []))
        if topics:
            result.append((u["title"], topics))

    exp = split_experiments(item.get("experiments") or [])
    if exp:
        result.append(("Lab Experiments", exp))

    return result


if __name__ == "__main__":
    from extractor import extract_text_from_pdf, parse_all_subjects

    if len(sys.argv) < 2:
        print('Use: python cleaner.py "path\\to\\syllabus.pdf" [COURSE_CODE]')
        sys.exit(1)

    only_code = sys.argv[2].upper() if len(sys.argv) > 2 else None

    with open(sys.argv[1], "rb") as f:
        text = extract_text_from_pdf(f.read())

    total = 0
    for item in parse_all_subjects(text):
        units = build_units(item)
        total += sum(len(t) for _, t in units)
        code = (item.get("course_code") or "").upper()
        if only_code and code != only_code:
            continue
        print(f"\n== {item.get('subject')} ({code})")
        for title, topics in units:
            print(f"  {title}: {len(topics)} topics")
            show = topics if only_code else topics[:5]
            for t in show:
                print("     -", t)
    print("\nTotal topics:", total)
    