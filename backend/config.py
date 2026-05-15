import os
from dotenv import load_dotenv

load_dotenv()

LLM_API_KEY = os.getenv("LLM_API_KEY", "")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://imllm.intermesh.net/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "openrouter/qwen/qwen3-32b")

OPENPROJECT_BASE_URL = os.getenv("OPENPROJECT_BASE_URL", "https://project.intermesh.net/api/v3")
OPENPROJECT_API_TOKEN = os.getenv("OPENPROJECT_API_TOKEN", "")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
PORT = int(os.getenv("PORT", "8000"))

# Email
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

# Slack
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHROMA_DB_PATH = os.path.join(BASE_DIR, "data", "chroma_db")
UPLOADS_PATH = os.path.join(BASE_DIR, "data", "uploads")
