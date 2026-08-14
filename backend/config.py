from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    DB_HOST: str = "127.0.0.1"
    DB_PORT: int = 3306
    DB_USER: str = "root"
    DB_PASSWORD: str = "12345678"
    DB_NAME: str = "sepsis_db"
    
    # Optional tuning
    DB_MIN_CONNECTIONS: int = 1
    DB_MAX_CONNECTIONS: int = 10

    # Pydantic Settings will automatically read from .env if present
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
