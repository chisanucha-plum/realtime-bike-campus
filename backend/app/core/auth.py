from typing import Annotated

from fastapi import Depends, HTTPException, status

from app.core import security
from app.core.exceptions import ServiceError
from app.database.database import DbSession
from app.database.user import User
from app.services.auth import AuthService


def get_user(
    db: DbSession,
    token: Annotated[str, Depends(security.oauth2_scheme)],
) -> User:
    """Resolve the current authenticated user from the Bearer JWT token."""
    try:
        if token.startswith("Bearer "):
            token = token.removeprefix("Bearer ")
        return AuthService(db).get_current_user(token)
    except HTTPException:
        raise
    except ServiceError as e:
        if "disabled" in str(e).lower():
            raise
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
        ) from e


CurrentUserDep = Annotated[User, Depends(get_user)]
