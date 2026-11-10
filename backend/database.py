from datetime import datetime

from sqlalchemy import (
    Column, DateTime, ForeignKey, Integer, String, Text, create_engine,
    inspect, text,
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker

# SQLite file backend folder mein apne aap ban jayegi
DATABASE_URL = "sqlite:///./syllabify.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    subjects = relationship("Subject", back_populates="user")


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    # nullable: purane (login se pehle ke) subjects ka user nahi hota
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="subjects")
    units = relationship(
        "Unit", back_populates="subject", cascade="all, delete-orphan"
    )


class Unit(Base):
    __tablename__ = "units"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    title = Column(String(255), nullable=False)
    order_no = Column(Integer, default=0)

    subject = relationship("Subject", back_populates="units")
    topics = relationship(
        "Topic", back_populates="unit", cascade="all, delete-orphan"
    )


class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"), nullable=False)
    title = Column(String(500), nullable=False)
    order_no = Column(Integer, default=0)
    # pending | in_progress | completed
    status = Column(String(20), default="pending", nullable=False)
    last_studied = Column(DateTime, nullable=True)

    unit = relationship("Unit", back_populates="topics")
    resources = relationship(
        "Resource", back_populates="topic", cascade="all, delete-orphan"
    )


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False)
    video_id = Column(String(50), nullable=False)
    title = Column(Text, nullable=False)
    channel = Column(String(255))
    thumbnail = Column(Text)
    url = Column(Text, nullable=False)
    # dedicated | full_lecture
    kind = Column(String(20), default="dedicated")
    # Sirf tab bharenge jab transcript se sach mein mila ho, warna None
    start_seconds = Column(Integer, nullable=True)

    topic = relationship("Topic", back_populates="resources")


def init_db():
    Base.metadata.create_all(bind=engine)

    # Purani database mein subjects table ke andar user_id column jodo
    cols = [c["name"] for c in inspect(engine).get_columns("subjects")]
    if "user_id" not in cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE subjects ADD COLUMN user_id INTEGER"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    print("Database ready: syllabify.db")