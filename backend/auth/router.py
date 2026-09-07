"""
Auth REST API router.

Endpoints:
  POST /auth/register  — สร้าง account ใหม่
  POST /auth/login     — login, รับ JWT
  GET  /auth/me        — ดูข้อมูล user ปัจจุบัน
  GET  /auth/users     — รายชื่อ users ทั้งหมด (it_admin เท่านั้น)
  PUT  /auth/users/{id}/deactivate  — ระงับ account (it_admin เท่านั้น)
"""
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database_auth import get_db
from .models import User, UserRole
from .schemas import RegisterRequest, LoginRequest, TokenResponse, UserOut
from .service import register_user, login_user, get_current_user, require_role

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserOut, status_code=201)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    """สมัครสมาชิกใหม่ (ชื่อ สกุล ตำแหน่ง username password)"""
    user = register_user(req, db)
    return UserOut.model_validate(user)


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """เข้าสู่ระบบ — คืน JWT token"""
    return login_user(req, db)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    """ดูข้อมูล user ที่ login อยู่ปัจจุบัน"""
    return UserOut.model_validate(current_user)


@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.it_admin)),
):
    """รายชื่อ users ทั้งหมด — เฉพาะ IT Admin"""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [UserOut.model_validate(u) for u in users]


@router.put("/users/{user_id}/deactivate", response_model=UserOut)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(UserRole.it_admin)),
):
    """ระงับบัญชี user — เฉพาะ IT Admin"""
    from fastapi import HTTPException
    if admin.id == user_id:
        raise HTTPException(status_code=400, detail="ไม่สามารถระงับบัญชีตัวเองได้")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ไม่พบ user")
    user.is_active = False
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)
