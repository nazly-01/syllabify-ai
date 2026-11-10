from datetime import datetime

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import init_db, get_db, User, Subject, Unit, Topic, Resource
from auth import (
    hash_password,
    verify_password,
    create_token,
    get_current_user,
)
from extractor import extract_text_from_pdf, parse_all_subjects, parse_syllabus
from cleaner import build_units
from youtube import find_resources, YouTubeError
from dashboard import router as dashboard_router
from transcript import find_start_seconds

init_db()  # tables nahi hain to bana dega

app = FastAPI(title="Syllabify AI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(dashboard_router)

VALID_STATUS = {"pending", "in_progress", "completed"}


class SignupBody(BaseModel):
    name: str
    email: str
    password: str


class LoginBody(BaseModel):
    email: str
    password: str


class RenameBody(BaseModel):
    name: str


class StatusBody(BaseModel):
    status: str


def user_to_dict(u: User) -> dict:
    return {"id": u.id, "name": u.name, "email": u.email}


def subject_to_dict(s: Subject) -> dict:
    units = sorted(s.units, key=lambda u: u.order_no)
    return {
        "id": s.id,
        "name": s.name,
        "units": [
            {
                "id": u.id,
                "title": u.title,
                "topics": [
                    {"id": t.id, "title": t.title, "status": t.status}
                    for t in sorted(u.topics, key=lambda t: t.order_no)
                ],
            }
            for u in units
        ],
    }


def resource_to_dict(r: Resource) -> dict:
    return {
        "id": r.id,
        "video_id": r.video_id,
        "title": r.title,
        "channel": r.channel,
        "thumbnail": r.thumbnail,
        "url": r.url,
        "kind": r.kind,
        "start_seconds": r.start_seconds,  # None = timestamp available nahi
    }


def get_owned_subject(db: Session, user: User, subject_id: int) -> Subject:
    s = db.get(Subject, subject_id)
    if not s or s.user_id != user.id:
        raise HTTPException(404, "Subject nahi mila.")
    return s


def get_owned_topic(db: Session, user: User, topic_id: int) -> Topic:
    t = db.get(Topic, topic_id)
    if not t or t.unit.subject.user_id != user.id:
        raise HTTPException(404, "Topic nahi mila.")
    return t


@app.get("/")
def home():
    return {"message": "Syllabify AI backend is running"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ---------------- AUTH ----------------


@app.post("/api/auth/signup")
def signup(body: SignupBody, db: Session = Depends(get_db)):
    name = body.name.strip()
    email = body.email.strip().lower()

    if not name:
        raise HTTPException(400, "Naam daalo.")
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(400, "Sahi email daalo.")
    if len(body.password) < 6:
        raise HTTPException(400, "Password kam se kam 6 akshar ka rakho.")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "Ye email pehle se registered hai. Login karo.")

    is_first_user = db.query(User).count() == 0

    user = User(name=name, email=email, password_hash=hash_password(body.password))
    db.add(user)
    db.flush()  # user.id mil jaye

    # Pehle student ko login se pehle wale saare subjects mil jayenge
    adopted = 0
    if is_first_user:
        adopted = (
            db.query(Subject)
            .filter(Subject.user_id.is_(None))
            .update({"user_id": user.id}, synchronize_session=False)
        )

    db.commit()
    db.refresh(user)

    return {
        "token": create_token(user.id),
        "user": user_to_dict(user),
        "adopted_subjects": adopted,
    }


@app.post("/api/auth/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Email ya password galat hai.")
    return {"token": create_token(user.id), "user": user_to_dict(user)}


@app.get("/api/auth/me")
def me(user: User = Depends(get_current_user)):
    return user_to_dict(user)


# ---------------- UPLOAD + SUBJECTS ----------------


@app.post("/api/upload")
async def upload_syllabus(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Sirf PDF file upload karo.")

    data = await file.read()
    try:
        text = extract_text_from_pdf(data)
    except ValueError as e:
        raise HTTPException(422, str(e))

    fallback = (file.filename or "Subject").rsplit(".", 1)[0]

    items = parse_all_subjects(text)
    if not items:
        items = [parse_syllabus(text, fallback)]

    # Duplicate check sirf is student ke subjects mein
    existing = {
        name
        for (name,) in db.query(Subject.name).filter(Subject.user_id == user.id).all()
    }
    created, skipped = [], []

    for item in items:
        units = build_units(item)
        if not units:
            continue

        name = item.get("subject") or fallback
        code = item.get("course_code")
        if code:
            name = f"{name} ({code})"

        if name in existing:
            skipped.append(name)
            continue

        subject = Subject(name=name, user_id=user.id)
        for ui, (utitle, topics) in enumerate(units):
            unit = Unit(title=utitle, order_no=ui)
            for ti, t in enumerate(topics):
                unit.topics.append(Topic(title=t, order_no=ti))
            subject.units.append(unit)

        db.add(subject)
        created.append(subject)
        existing.add(name)

    if not created and not skipped:
        raise HTTPException(
            422, "Syllabus mein units/topics nahi mile. PDF check karo."
        )

    db.commit()
    for s in created:
        db.refresh(s)

    return {
        "subjects_added": len(created),
        "skipped_already_exist": skipped,
        "subjects": [subject_to_dict(s) for s in created],
    }


@app.get("/api/subjects")
def list_subjects(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    subjects = (
        db.query(Subject)
        .filter(Subject.user_id == user.id)
        .order_by(Subject.id)
        .all()
    )
    return [subject_to_dict(s) for s in subjects]


@app.get("/api/subjects/{subject_id}")
def get_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return subject_to_dict(get_owned_subject(db, user, subject_id))


@app.patch("/api/subjects/{subject_id}")
def rename_subject(
    subject_id: int,
    body: RenameBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = get_owned_subject(db, user, subject_id)
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Naam khali nahi ho sakta.")
    s.name = name
    db.commit()
    return {"id": s.id, "name": s.name}


@app.delete("/api/subjects/{subject_id}")
def delete_subject(
    subject_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = get_owned_subject(db, user, subject_id)
    db.delete(s)
    db.commit()
    return {"deleted": subject_id}


@app.delete("/api/subjects")
def delete_all_subjects(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    """Sirf is student ke saare subjects hatata hai (testing ke liye)."""
    count = 0
    for s in db.query(Subject).filter(Subject.user_id == user.id).all():
        db.delete(s)
        count += 1
    db.commit()
    return {"deleted_subjects": count}


# ---------------- TOPICS ----------------


@app.get("/api/topics/{topic_id}/resources")
def topic_resources(
    topic_id: int,
    refresh: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Topic ke videos. Pehli baar YouTube se, baad mein database se."""
    topic = get_owned_topic(db, user, topic_id)

    if topic.resources and not refresh:
        return {
            "topic_id": topic.id,
            "title": topic.title,
            "cached": True,
            "resources": [resource_to_dict(r) for r in topic.resources],
        }

    subject_name = topic.unit.subject.name
    try:
        found = find_resources(topic.title, subject_name)
    except YouTubeError as e:
        raise HTTPException(503, str(e))

    if found:
        for r in list(topic.resources):  # refresh par purane hatao
            db.delete(r)
        for v in found:
            topic.resources.append(
                Resource(
                    video_id=v["video_id"],
                    title=v["title"],
                    channel=v["channel"],
                    thumbnail=v["thumbnail"],
                    url=v["url"],
                    kind=v["kind"],
                    # transcript match ke bina kabhi fake nahi
                    start_seconds=find_start_seconds(v["video_id"], topic.title),
                )
            )
        db.commit()
        db.refresh(topic)

    return {
        "topic_id": topic.id,
        "title": topic.title,
        "cached": False,
        "resources": [resource_to_dict(r) for r in topic.resources],
    }


@app.patch("/api/topics/{topic_id}/status")
def update_topic_status(
    topic_id: int,
    body: StatusBody,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    topic = get_owned_topic(db, user, topic_id)
    if body.status not in VALID_STATUS:
        raise HTTPException(
            400, "status sirf pending, in_progress ya completed ho sakta hai."
        )

    topic.status = body.status
    if body.status != "pending":
        topic.last_studied = datetime.utcnow()
    db.commit()
    return {"id": topic.id, "status": topic.status}