import aiomysql
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from .config import settings

logger = logging.getLogger(__name__)

class DatabasePool:
    def __init__(self):
        self.pool: aiomysql.Pool | None = None
        self.simulate_disconnected: bool = False

    async def connect(self):
        try:
            if self.pool is not None:
                try:
                    self.pool.close()
                    await self.pool.wait_closed()
                except Exception:
                    pass
                self.pool = None

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
            self.simulate_disconnected = False
            logger.info("Successfully connected to MySQL database pool.")
        except Exception as e:
            logger.error(f"Error connecting to MySQL: {e}")
            raise e

    async def disconnect(self):
        if self.pool is not None:
            self.pool.close()
            await self.pool.wait_closed()
            self.pool = None
            logger.info("MySQL database pool closed.")

    @asynccontextmanager
    async def get_connection(self) -> AsyncGenerator[aiomysql.Connection, None]:
        if not self.pool:
            raise RuntimeError("Database pool is offline or not initialized. Connection closed.")
        
        async with self.pool.acquire() as conn:
            yield conn

db_pool = DatabasePool()


class DashboardDatabasePool:
    """Separate connection pool for rtsas_dashboard (treatment status & archive)."""
    def __init__(self):
        self.pool: aiomysql.Pool | None = None

    async def connect(self):
        try:
            if self.pool is not None:
                try:
                    self.pool.close()
                    await self.pool.wait_closed()
                except Exception:
                    pass
                self.pool = None

            self.pool = await aiomysql.create_pool(
                host=settings.DASHBOARD_DB_HOST,
                port=settings.DASHBOARD_DB_PORT,
                user=settings.DASHBOARD_DB_USER,
                password=settings.DASHBOARD_DB_PASSWORD,
                db=settings.DASHBOARD_DB_NAME,
                minsize=settings.DASHBOARD_DB_MIN_CONNECTIONS,
                maxsize=settings.DASHBOARD_DB_MAX_CONNECTIONS,
                autocommit=True,
                charset='utf8mb4'
            )
            logger.info("Successfully connected to Dashboard database pool (rtsas_dashboard).")
        except Exception as e:
            logger.error(f"Error connecting to Dashboard DB: {e}")
            raise e

    async def disconnect(self):
        if self.pool is not None:
            self.pool.close()
            await self.pool.wait_closed()
            self.pool = None
            logger.info("Dashboard database pool closed.")

    @asynccontextmanager
    async def get_connection(self) -> AsyncGenerator[aiomysql.Connection, None]:
        if not self.pool:
            raise RuntimeError("Dashboard database pool is offline or not initialized.")

        async with self.pool.acquire() as conn:
            yield conn

dashboard_pool = DashboardDatabasePool()
