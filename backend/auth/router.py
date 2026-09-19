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
from .schemas import RegisterRequest, LoginRequest, TokenResponse, UserOut, ResetPasswordRequest
from .service import (
    register_user,
    login_user,
    get_current_user,
    require_role,
    reset_user_password,
    delete_user,
)

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


@router.put("/users/{user_id}/reset-password", response_model=UserOut)
def reset_password(
    user_id: int,
    req: ResetPasswordRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(UserRole.it_admin)),
):
    """รีเซ็ตรหัสผ่านผู้ใช้ — เฉพาะ IT Admin"""
    user = reset_user_password(user_id, req.password, db)
    return UserOut.model_validate(user)


@router.delete("/users/{user_id}")
def remove_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(UserRole.it_admin)),
):
    """ลบผู้ใช้งานอย่างถาวร — เฉพาะ IT Admin"""
    delete_user(user_id, admin, db)
    return {"detail": "ลบผู้ใช้งานสำเร็จ", "user_id": user_id}
