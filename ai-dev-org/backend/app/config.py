"""Application configuration loader for ai-dev-org.

Reads environment variables and provides typed settings using pydantic-settings.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Core runtime settings for the multi-agent system."""
    # API Credentials
    GEMINI_API_KEY: str = ""

    # Path Topology
    DATA_DIR: str = "./data"
    LOG_DIR: str = "./logs"
    FRONTEND_URL: str = "http://localhost:3000"

    # Gemini Model Policies
    GEMINI_MODEL_PRO: str = os.environ.get("MODEL_REASONING", "gemini/gemini-flash-latest")
    GEMINI_MODEL_FLASH: str = os.environ.get("MODEL_FAST", "gemini/gemini-flash-latest")
    GEMINI_MODEL_EXP: str = os.environ.get("MODEL_CODING", "gemini/gemini-flash-latest")

    # Router Policies
    ROUTER_MAX_RETRIES: int = 2
    ROUTER_FALLBACK_MODEL: str = os.environ.get("MODEL_FAST", "gemini/gemini-flash-latest")

    # Memory Vector Storage
    USE_CHROMA: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def data_path(self) -> Path:
        """Resolved Path object for DATA_DIR."""
        return Path(self.DATA_DIR).resolve()

    @property
    def log_path(self) -> Path:
        """Resolved Path object for LOG_DIR."""
        return Path(self.LOG_DIR).resolve()


settings = Settings()
