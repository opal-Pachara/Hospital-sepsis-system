from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    # ── HOSxP / Patient DB (read-only, external MySQL) ──
    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = "12345678"
    DB_NAME: str = "sepsis_db"

    DB_MIN_CONNECTIONS: int = 1
    DB_MAX_CONNECTIONS: int = 10

    # ── Dashboard DB (separate database for treatment status & archive) ──
    DASHBOARD_DB_HOST: str = "127.0.0.1"
    DASHBOARD_DB_PORT: int = 3306
    DASHBOARD_DB_USER: str = "root"
    DASHBOARD_DB_PASSWORD: str = "12345678"
    DASHBOARD_DB_NAME: str = "rtsas_dashboard"
    DASHBOARD_DB_MIN_CONNECTIONS: int = 1
    DASHBOARD_DB_MAX_CONNECTIONS: int = 5

    # ── Auth DB (MySQL inside Docker for user accounts) ──
    AUTH_DB_URL: str = "mysql+pymysql://rtsas:rtsas@localhost:3307/rtsas_auth"

    # ── JWT ──
    JWT_SECRET: str = "CHANGE_ME_BEFORE_DEPLOY_rtsas_secret_2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_HOURS: int = 8  # 1 shift

    # ── Query Behavior ──
    # If False (default): only queries CURDATE(). If no patients today, returns empty list (clean state).
    # If True: falls back to latest past date in DB if today has no records.
    ENABLE_DATE_FALLBACK: bool = False

    model_config = SettingsConfigDict(env_file=(".env", "backend/.env"), env_file_encoding="utf-8", extra="ignore")

settings = Settings()
