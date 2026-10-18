from fastapi import APIRouter, HTTPException, Request, Response, status

from app.configuration import Configuration
from app.core.auth import CurrentUserDep
from app.core.security import (
    clear_refresh_cookie,
    create_access_token,
    create_refresh_token,
    set_refresh_cookie,
    verify_refresh_token,
)
from app.database.database import DbSession
from app.database.user import User
from app.schemas.user import (
    AuthUserSnapshot,
    LoginResponse,
    Token,
    UserLogin,
    UserResponse,
)
from app.services.auth import AuthService

config = Configuration.get_config()

router = APIRouter(prefix="/user", tags=["user"])


@router.post("/login")
def login(
    response: Response,
    data: UserLogin,
    db: DbSession,
) -> LoginResponse:
    user = AuthService(db).authenticate(data.email, data.password)
    claims = {"sub": user.id, "role": user.role}
    access = create_access_token(claims)
    refresh = create_refresh_token(claims)

    set_refresh_cookie(response, refresh)
    return LoginResponse(
        access_token=access,
        refresh_token=refresh,
        user=AuthUserSnapshot(
            id=user.id,
            username=user.username,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
        ),
    )


@router.post("/refresh_token")
def refresh_token(
    response: Response,
    request: Request,
    db: DbSession,
) -> Token:
    cookie_cfg = config.refresh_token_cookie
    token = request.cookies.get(cookie_cfg.cookie_name) or request.cookies.get(
        cookie_cfg.legacy_cookie_name
    )
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )

    payload = verify_refresh_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    role = db.query(User.role).filter(User.id == user_id, User.disabled.is_(False)).scalar()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    claims = {"sub": user_id, "role": role}
    access = create_access_token(claims)
    new_refresh = create_refresh_token(claims)

    set_refresh_cookie(response, new_refresh)
    return Token(
        access_token=access,
        refresh_token=new_refresh,
    )


@router.post("/logout")
def logout(response: Response) -> dict[str, str]:
    clear_refresh_cookie(response)
    return {"message": "Successfully logged out"}


@router.get("/me")
def get_me(user: CurrentUserDep) -> UserResponse:
    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        created_at=user.created_at,
        last_login=user.last_login,
    )
