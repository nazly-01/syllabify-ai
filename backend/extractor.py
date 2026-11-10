
import re
import sys
import json
import pymupdf as fitz


# Module-1, MODULE 2, Unit-III, etc.
UNIT_RE = re.compile(
    r"^\s*(?:module|unit)\s*[-–—:.]?\s*"
    r"(\d+|[ivxlcdm]+)\b.*$",
    re.IGNORECASE
)

STOP_RE = re.compile(
    r"course outcomes?|course skill set|assessment details|"
    r"suggested learning resources|web links and video lectures|"
    r"activity based learning",
    re.IGNORECASE
)

SKIP_RE = re.compile(
    r"template for practical|annexure|"
    r"^\s*\d{8}\s*$|^\s*@#@#@\s*$|"
    r"^\s*page\s+\d+",
    re.IGNORECASE
)

ROMAN_TASK_RE = re.compile(
    r"^([ivxlcdm]+)\s*[\).:-]\s*(.+)$",
    re.IGNORECASE
)

COURSE_CODE_RE = re.compile(
    r"^[A-Z0-9]{4,12}$"
)


def extract_text_from_pdf(data: bytes):
    doc = fitz.open(stream=data, filetype="pdf")
    text = "\n".join(page.get_text() for page in doc)
    doc.close()

    if len(text.strip()) < 30:
        raise ValueError("Could not extract enough text from PDF")

    return text


def _clean_text(text):
    return re.sub(r"\s+", " ", text).strip()


def _clean_topic(topic):
    topic = re.sub(r"^\s*[\d.]+[\).:-]?\s*", "", topic)
    topic = re.sub(r"^[●•▪➢\-]\s*", "", topic)
    return _clean_text(topic).strip(" -:;,.")


def _lines_to_topics(lines):
    topics = []
    seen = set()

    for line in lines:
        line = _clean_topic(line)

        if len(line) < 3:
            continue

        key = line.lower()

        if key not in seen:
            topics.append(line)
            seen.add(key)

    return topics


def _find_subject_name(lines, semester_index):
    ignored = (
        "vtu", "annexure", "semester", "course code",
        "cie marks", "see marks", "teaching hours",
        "template", "department", "total marks"
    )

    # Search up to 35 lines before Semester.
    for line in reversed(
        lines[max(0, semester_index - 35):semester_index]
    ):
        candidate = line.strip()

        if not candidate:
            continue

        lower = candidate.lower()

        if any(word in lower for word in ignored):
            continue

        if SKIP_RE.search(candidate):
            continue

        if candidate.isupper() and re.search(r"[A-Z]", candidate):
            if len(candidate) > 3 and not candidate.isdigit():
                return _clean_text(candidate).title()

    return "Untitled Subject"


def parse_syllabus(text, fallback_name="Untitled Subject"):
    lines = text.splitlines()

    units = []
    current_unit = None
    topic_lines = []

    for line in lines:
        line = line.strip()

        if not line:
            continue
        if current_unit is not None and STOP_RE.match(line):
            break

        if SKIP_RE.search(line):
            continue
        

        if SKIP_RE.search(line):
            continue

        match = UNIT_RE.match(line)

        if match:
            if current_unit:
                current_unit["topics"] = _lines_to_topics(topic_lines)
                units.append(current_unit)

            number = len(units) + 1

            current_unit = {
                "title": f"Unit {number}",
                "order_no": number,
                "topics": []
            }

            topic_lines = []
            continue

        # Ignore introductory metadata before Module 1.
        if current_unit is None:
            continue

        # Textbook references are not syllabus topics.
        if re.match(r"^(textbook|text book|reference book)\s*:?", line, re.I):
            continue

        topic_lines.append(line)

    if current_unit:
        current_unit["topics"] = _lines_to_topics(topic_lines)
        units.append(current_unit)

    return {
        "subject": fallback_name,
        "units": units
    }


def parse_practical_syllabus(text, fallback_name="Untitled Subject"):
    lines = text.splitlines()

    start_index = None

    # Find the practical experiments table.
    for i, line in enumerate(lines):
        if "sl.no" in line.lower().replace(" ", ""):
            nearby = " ".join(lines[i:i + 5]).lower()

            if "experiment" in nearby:
                start_index = i + 1
                break

    if start_index is None:
        return {
            "subject": fallback_name,
            "experiments": []
        }

    experiments = []
    current = None

    for line in lines[start_index:]:
        line = line.strip()

        if not line:
            continue

        if STOP_RE.search(line):
            break

        if SKIP_RE.search(line):
            continue

        if line.lower() in ("experiments", "experiment"):
            continue

        # Experiment numbers must be sequential standalone numbers.
        if re.fullmatch(r"\d{1,2}", line):
            number = int(line)
            expected = len(experiments) + 1

            if number == expected:
                if current:
                    experiments.append(current)

                current = {
                    "experiment_no": number,
                    "experiment_name": "",
                    "tasks": []
                }
                continue

        if current is None:
            continue

        task_match = ROMAN_TASK_RE.match(line)

        if task_match:
            current["tasks"].append(task_match.group(2).strip())
            continue

        # Append wrapped lines to the current task or experiment.
        if current["tasks"]:
            current["tasks"][-1] += " " + line
        else:
            if current["experiment_name"]:
                current["experiment_name"] += " " + line
            else:
                current["experiment_name"] = line

    if current:
        experiments.append(current)

    for experiment in experiments:
        experiment["experiment_name"] = _clean_text(
            experiment["experiment_name"]
        )

        experiment["tasks"] = [
            _clean_text(task)
            for task in experiment["tasks"]
            if task.strip()
        ]

    return {
        "subject": fallback_name,
        "experiments": experiments
    }


def parse_all_subjects(text):
    lines = text.splitlines()

    # Find every subject's Semester heading.
    semester_indices = [
        i for i, line in enumerate(lines)
        if line.strip().lower() == "semester"
    ]

    subjects = []
    seen_codes = set()

    for position, start in enumerate(semester_indices):

        end = (
            semester_indices[position + 1]
            if position + 1 < len(semester_indices)
            else len(lines)
        )

        section_lines = lines[start:end]
        section = "\n".join(section_lines)

        # Find course code near the Course Code label.
        course_code = None

        for i, line in enumerate(section_lines):
            if "course code" in line.lower():
                for candidate in section_lines[i:i + 4]:
                    candidate = candidate.strip()

                    if COURSE_CODE_RE.fullmatch(candidate):
                        course_code = candidate
                        break

            if course_code:
                break

        if not course_code or course_code in seen_codes:
            continue

        seen_codes.add(course_code)

        subject_name = _find_subject_name(lines, start)

        # Determine whether this subject contains a practical table.
        has_practical_table = False

        for i, line in enumerate(section_lines):
            if "sl.no" in line.lower().replace(" ", ""):
                nearby = " ".join(section_lines[i:i + 5]).lower()

                if "experiment" in nearby:
                    has_practical_table = True
                    break

        # Detect combined theory + practical courses.
        is_combined = bool(
            re.search(
                r"theory\s*/\s*practical",
                section,
                re.IGNORECASE
            )
        )

        if has_practical_table:
            practical = parse_practical_syllabus(
                section,
                subject_name
            )
        else:
            practical = {"experiments": []}

        theory = parse_syllabus(section, subject_name)

        if is_combined:
            course_type = "combined"
        elif has_practical_table:
            course_type = "practical"
        else:
            course_type = "theory"

        result = {
            "subject": subject_name,
            "course_code": course_code,
            "course_type": course_type
        }

        if course_type in ("theory", "combined"):
            result["units"] = theory["units"]

        if course_type in ("practical", "combined"):
            result["experiments"] = practical["experiments"]

        subjects.append(result)

    return subjects


if __name__ == "__main__":

    if len(sys.argv) < 2:
        print("Usage: python extractor.py <pdf_path>")
        sys.exit(1)

    pdf_path = sys.argv[1]

    with open(pdf_path, "rb") as file:
        pdf_data = file.read()

    extracted_text = extract_text_from_pdf(pdf_data)
    subjects = parse_all_subjects(extracted_text)

    print(json.dumps(subjects, indent=4, ensure_ascii=False))

    theory_units = sum(
        len(s.get("units", []))
        for s in subjects
    )

    theory_topics = sum(
        len(unit.get("topics", []))
        for s in subjects
        for unit in s.get("units", [])
    )

    practical_experiments = sum(
        len(s.get("experiments", []))
        for s in subjects
    )

    practical_tasks = sum(
        len(exp.get("tasks", []))
        for s in subjects
        for exp in s.get("experiments", [])
    )

    print("\n========== SUMMARY ==========")
    print("Subjects:", len(subjects))
    print("Theory Units:", theory_units)
    print("Theory Topics:", theory_topics)
    print("Practical Experiments:", practical_experiments)
    print("Practical Tasks:", practical_tasks)
