import logging
import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]   # backend/app/config.py -> repo root
raw_data_dir = os.getenv("DATA_DIR", "data").replace("../", "").replace("..\\", "").replace("./", "").replace(".\\", "")
raw_log_dir = os.getenv("LOG_DIR", "logs").replace("../", "").replace("..\\", "").replace("./", "").replace(".\\", "")
DATA_DIR: Path = (REPO_ROOT / (raw_data_dir or "data")).resolve()
LOG_DIR:  Path = (REPO_ROOT / (raw_log_dir or "logs")).resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "backend.log", mode="a", encoding="utf-8"),
        logging.StreamHandler(),
    ],
    force=True,
)


class Settings(BaseSettings):
    """Core runtime settings for the multi-agent system."""
    # Offline Demo Mode
    DEMO_MODE: bool = False

    # API Credentials
    GEMINI_API_KEY: str = ""

    # Path Topology
    DATA_DIR: str = str(DATA_DIR)
    LOG_DIR: str = str(LOG_DIR)
    FRONTEND_URL: str = "http://localhost:3000"

    # Gemini Model Policies
    GEMINI_MODEL_PRO: str = "gemini/gemini-2.0-flash-exp"
    GEMINI_MODEL_FLASH: str = "gemini/gemini-1.5-flash"
    GEMINI_MODEL_EXP: str = "gemini/gemini-2.0-flash-exp"

    # Router Policies
    ROUTER_MAX_RETRIES: int = 2
    ROUTER_FALLBACK_MODEL: str = "gemini/gemini-1.5-flash"

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
        return DATA_DIR

    @property
    def log_path(self) -> Path:
        """Resolved Path object for LOG_DIR."""
        return LOG_DIR


settings = Settings()

