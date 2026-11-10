import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from database import User, get_db

ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(ENV_PATH)

ALGORITHM = "HS256"
TOKEN_DAYS = 7


def _secret() -> str:
    """JWT secret .env mein na ho to apne aap bana ke wahin save kar deta hai."""
    s = os.getenv("JWT_SECRET", "").strip()
    if not s:
        s = secrets.token_hex(32)
        with open(ENV_PATH, "a", encoding="ascii") as f:
            f.write(f"\nJWT_SECRET={s}\n")
        os.environ["JWT_SECRET"] = s
    return s


SECRET = _secret()
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    # bcrypt sirf pehle 72 bytes padhta hai
    raw = password.encode("utf-8")[:72]
    return bcrypt.hashpw(raw, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8")[:72], hashed.encode("utf-8"))
    except ValueError:
        return False


def create_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_DAYS),
    }
    return jwt.encode(payload, SECRET, algorithm=ALGORITHM)


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    """Har protected route mein ye lagega. Token galat/expired ho to 401."""
    if creds is None:
        raise HTTPException(401, "Login karo.")
    try:
        data = jwt.decode(creds.credentials, SECRET, algorithms=[ALGORITHM])
        user_id = int(data["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "Session expire ho gaya. Dobara login karo.")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(401, "User nahi mila. Dobara login karo.")
    return user