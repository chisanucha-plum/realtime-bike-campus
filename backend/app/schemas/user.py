from datetime import datetime
from enum import Enum

from pydantic import BaseModel, EmailStr


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    refresh_token: str


class AuthUserSnapshot(BaseModel):
    id: str
    username: str | None = None
    email: EmailStr | None = None
    full_name: str | None = None
    role: str


class LoginResponse(Token):
    user: AuthUserSnapshot


class UserResponse(BaseModel):
    id: str
    username: str | None = None
    email: EmailStr | None = None
    full_name: str | None = None
    role: str
    created_at: datetime | None = None
    last_login: datetime | None = None


class UserRole(str, Enum):
    ADMIN = "admin"
    SECURITY = "security"

