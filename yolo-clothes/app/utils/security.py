#yolo-clothes\app\utils\security.py
import hashlib, hmac, os, base64
from datetime import datetime, timedelta
from jose import jwt
from ..config import settings

# ─── пароли ──────────────────────────────────────────────────────────
def _salt() -> str:
    return base64.urlsafe_b64encode(os.urandom(16)).decode()

def hash_password(password: str, *, salt: str | None = None) -> str:
    """
    Возвращает строку salt$hash, где hash = PBKDF2‑HMAC‑SHA256( password, salt, 100_000 )
    """
    if salt is None:
        salt = _salt()
    pwd = password.encode()
    dk  = hashlib.pbkdf2_hmac("sha256", pwd, salt.encode(), 100_000)
    return f"{salt}${dk.hex()}"

def verify_password(password: str, stored: str) -> bool:
    salt, good_hash = stored.split("$", 1)
    return hmac.compare_digest(hash_password(password, salt=salt), stored)

# ─── JWT ─────────────────────────────────────────────────────────────
def create_access_token(data: dict, minutes: int | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(
        minutes = minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
