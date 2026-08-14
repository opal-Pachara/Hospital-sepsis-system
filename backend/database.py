import aiomysql
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from .config import settings

logger = logging.getLogger(__name__)

class DatabasePool:
    def __init__(self):
        self.pool: aiomysql.Pool | None = None

    async def connect(self):
        try:
            self.pool = await aiomysql.create_pool(
                host=settings.DB_HOST,
                port=settings.DB_PORT,
                user=settings.DB_USER,
                password=settings.DB_PASSWORD,
                db=settings.DB_NAME,
                minsize=settings.DB_MIN_CONNECTIONS,
                maxsize=settings.DB_MAX_CONNECTIONS,
                autocommit=True,
                charset='utf8mb4'
            )
            logger.info("Successfully connected to MySQL database pool.")
        except Exception as e:
            logger.error(f"Error connecting to MySQL: {e}")
            raise e

    async def disconnect(self):
        if self.pool is not None:
            self.pool.close()
            await self.pool.wait_closed()
            logger.info("MySQL database pool closed.")

    @asynccontextmanager
    async def get_connection(self) -> AsyncGenerator[aiomysql.Connection, None]:
        if not self.pool:
            raise RuntimeError("Database pool is not initialized. Call connect() first.")
        
        async with self.pool.acquire() as conn:
            yield conn

db_pool = DatabasePool()
