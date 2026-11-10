from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth import get_current_user
from database import get_db, User, Subject, Unit, Topic

router = APIRouter(prefix="/api")


def pct(done: int, total: int) -> int:
    return round(done * 100 / total) if total else 0


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    # Sirf login kiye hue student ke subjects
    subjects = (
        db.query(Subject)
        .filter(Subject.user_id == user.id)
        .order_by(Subject.id)
        .all()
    )

    total = completed = in_progress = 0
    subject_stats = []

    for s in subjects:
        s_total = s_done = s_prog = 0
        unit_stats = []

        for u in sorted(s.units, key=lambda u: u.order_no):
            u_total = len(u.topics)
            u_done = sum(1 for t in u.topics if t.status == "completed")
            u_prog = sum(1 for t in u.topics if t.status == "in_progress")
            s_total += u_total
            s_done += u_done
            s_prog += u_prog
            unit_stats.append(
                {
                    "id": u.id,
                    "title": u.title,
                    "total": u_total,
                    "completed": u_done,
                    "percent": pct(u_done, u_total),
                }
            )

        total += s_total
        completed += s_done
        in_progress += s_prog
        subject_stats.append(
            {
                "id": s.id,
                "name": s.name,
                "total": s_total,
                "completed": s_done,
                "in_progress": s_prog,
                "pending": s_total - s_done - s_prog,
                "percent": pct(s_done, s_total),
                "units": unit_stats,
            }
        )

    # Recently studied: bhi sirf is student ke topics
    recent = (
        db.query(Topic)
        .join(Unit, Topic.unit_id == Unit.id)
        .join(Subject, Unit.subject_id == Subject.id)
        .filter(Subject.user_id == user.id, Topic.last_studied.isnot(None))
        .order_by(Topic.last_studied.desc())
        .limit(5)
        .all()
    )

    return {
        "total_subjects": len(subjects),
        "total_topics": total,
        "completed": completed,
        "in_progress": in_progress,
        "pending": total - completed - in_progress,
        "overall_percent": pct(completed, total),
        "subjects": subject_stats,
        "recent_topics": [
            {
                "id": t.id,
                "title": t.title,
                "status": t.status,
                "unit": t.unit.title,
                "subject": t.unit.subject.name,
                "last_studied": t.last_studied.isoformat(),
            }
            for t in recent
        ],
    }