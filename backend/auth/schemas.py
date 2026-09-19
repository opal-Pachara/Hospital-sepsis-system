"""
Pydantic schemas for auth API requests and responses.
"""
from datetime import datetime
from pydantic import BaseModel, field_validator
from .models import UserRole


# ── Register ──────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    password: str
    firstname: str
    lastname: str
    role: UserRole

    @field_validator("username")
    @classmethod
    def username_min_length(cls, v: str) -> str:
        if len(v.strip()) < 4:
            raise ValueError("username ต้องมีอย่างน้อย 4 ตัวอักษร")
        return v.strip().lower()

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("password ต้องมีอย่างน้อย 6 ตัวอักษร")
        return v

    @field_validator("firstname", "lastname")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("ชื่อ/นามสกุลต้องไม่ว่างเปล่า")
        return v.strip()


# ── Login ─────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


# ── Reset Password ────────────────────────────────────────────────────────

class ResetPasswordRequest(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("password ต้องมีอย่างน้อย 6 ตัวอักษร")
        return v


# ── Token ─────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"


# ── User info ─────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: int
    username: str
    firstname: str
    lastname: str
    full_name: str
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# Update forward ref
TokenResponse.model_rebuild()
