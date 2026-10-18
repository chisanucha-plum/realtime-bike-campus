import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core import security
from app.core.exceptions import ServiceError
from app.database.user import User

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def authenticate(self, login_id: str, password: str) -> User:
        user = (
            self.db.query(User).filter(User.email == login_id).first()
            or self.db.query(User).filter(User.username == login_id).first()
        )
        if (
            not user
            or not user.hashed_password
            or not security.verify_password(password, user.hashed_password)
        ):
            logger.warning(f"Login attempt with invalid credentials: {login_id}")
            raise ServiceError("Invalid credentials")

        if user.disabled:
            logger.warning(f"Login attempt by disabled user: {login_id}")
            raise ServiceError("User account is disabled")

        try:
            user.last_login = datetime.now(timezone.utc)
            self.db.commit()
            self.db.refresh(user)
        except Exception as e:
            logger.error(f"Failed to update last_login for {login_id}: {e}")

        return user

    def get_current_user(self, token: str) -> User:
        try:
            user_id = security.decode_token(token)
        except Exception as e:
            logger.warning(f"Invalid token decode attempt: {e}")
            raise ServiceError(f"Invalid token: {e}") from e

        user = self.db.query(User).filter(User.id == user_id).first()
        if user is None:
            logger.warning(f"Token references non-existent user: {user_id}")
            raise ServiceError("User not found")

        if user.disabled:
            logger.warning(f"Access attempt by disabled user: {user_id}")
            raise ServiceError("User account is disabled")

        return user
