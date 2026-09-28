from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine, URL
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.configuration import Configuration

# Load configuration and create database connection
config = Configuration.get_config()
postgres_config = config.postgres

# Use Supabase's connection string when provided; keep component-based config
# for existing local PostgreSQL deployments.
DATABASE_URL = postgres_config.database_url or URL.create(
    drivername="postgresql",
    host=postgres_config.host,
    port=postgres_config.port,
    username=postgres_config.user,
    password=postgres_config.password,
    database=postgres_config.database,
)


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""

    pass


# Create SQLAlchemy engine and session factory
engine: Engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal: sessionmaker[Session] = sessionmaker(
    autocommit=False, autoflush=False, bind=engine
)


def init_database() -> None:
    """Initialize database by creating all tables.

    Imports all ORM models to register them with SQLAlchemy before creating tables.
    """
    from app.database import history_status  # noqa: F401
    from app.database import user  # noqa: F401

    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Provide database session as FastAPI dependency.

    Yields:
        SQLAlchemy Session for use in request handler

    Raises:
        Any exception raised by database operations
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
