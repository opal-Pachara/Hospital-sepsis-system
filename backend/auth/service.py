"""
Auth business logic: password hashing (bcrypt) and JWT token creation/verification.
Uses bcrypt directly (bypasses passlib compatibility issue with bcrypt>=4.x)
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from ..config import settings
from ..database_auth import get_db
from .models import User, UserRole
from .schemas import RegisterRequest, LoginRequest, UserOut, TokenResponse

# ── Password hashing (bcrypt directly) ───────────────────────────────────

def hash_password(plain: str) -> str:
    pw_bytes = plain.encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw_bytes, salt).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ── JWT ───────────────────────────────────────────────────────────────────

bearer_scheme = HTTPBearer(auto_error=False)

def create_access_token(user: User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.JWT_EXPIRE_HOURS)
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "firstname": user.firstname,
        "lastname": user.lastname,
        "role": user.role.value,
        "exp": expire,
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token ไม่ถูกต้องหรือหมดอายุ: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── FastAPI dependency ────────────────────────────────────────────────────

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="ต้องเข้าสู่ระบบก่อน",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_token(credentials.credentials)
    user_id = int(payload.get("sub", 0))
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="ไม่พบ user")
    return user


def require_role(*roles: UserRole):
    """Dependency factory — restricts endpoint to specific roles."""
    def _checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"บทบาท '{current_user.role.value}' ไม่มีสิทธิ์เข้าถึง endpoint นี้",
            )
        return current_user
    return _checker


# ── Register / Login ──────────────────────────────────────────────────────

def register_user(req: RegisterRequest, db: Session) -> User:
    existing = db.query(User).filter(User.username == req.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{req.username}' มีอยู่ในระบบแล้ว",
        )
    user = User(
        username=req.username,
        password_hash=hash_password(req.password),
        firstname=req.firstname,
        lastname=req.lastname,
        role=req.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def login_user(req: LoginRequest, db: Session) -> TokenResponse:
    user = db.query(User).filter(User.username == req.username.strip().lower()).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username หรือ Password ไม่ถูกต้อง",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="บัญชีนี้ถูกระงับการใช้งาน",
        )
    token = create_access_token(user)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))
