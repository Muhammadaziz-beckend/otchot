import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

# django configurations
if not load_dotenv():
    raise Exception(".env Not Found")

SECRET_KEY = os.getenv("SECRET_KEY")
DEBUG = os.getenv("DEBUG", "False") == "True"

# ALLOWED_HOSTS из .env через запятую, например:
# ALLOWED_HOSTS=offis.maximumcomfort.pro,localhost,127.0.0.1
_allowed_hosts = os.getenv("ALLOWED_HOSTS", "")
ALLOWED_HOSTS = [h.strip() for h in _allowed_hosts.split(",") if h.strip()] or ["*"]
AUTH_USER_MODEL = "account.User"

LANGUAGE_CODE = "ru"

TIME_ZONE = "Asia/Bishkek"

USE_I18N = True

USE_TZ = True