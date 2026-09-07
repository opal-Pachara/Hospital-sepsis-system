"""
SQLAlchemy sync engine for the auth database (user accounts).
Separate from the HOSxP aiomysql pool used for patient data.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from .config import settings

engine = create_engine(
    settings.AUTH_DB_URL,
    pool_pre_ping=True,       # Re-ping before using connection
    pool_recycle=3600,        # Recycle connections every 1 hour
    connect_args={"charset": "utf8mb4"},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields a DB session and closes on exit."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
