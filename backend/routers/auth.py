import json
import logging
import os
import hashlib
import hmac
import base64
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

from config import ALLOWED_EMAIL_DOMAIN, JWT_ALGORITHM, JWT_EXPIRE_HOURS, JWT_SECRET

log = logging.getLogger("auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
USERS_FILE = os.path.join(BASE_DIR, "data", "users.json")


class SignupRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)
    name: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=128)


def _ensure_users_file() -> None:
    os.makedirs(os.path.dirname(USERS_FILE), exist_ok=True)
    if not os.path.exists(USERS_FILE):
        with open(USERS_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)


def _load_users() -> list[dict]:
    _ensure_users_file()
    with open(USERS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data if isinstance(data, list) else []


def _save_users(users: list[dict]) -> None:
    _ensure_users_file()
    with open(USERS_FILE, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2)


def _hash_password(password: str, salt_hex: str | None = None) -> str:
    salt = bytes.fromhex(salt_hex) if salt_hex else os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 200000)
    return f"{salt.hex()}${digest.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$", 1)
    except ValueError:
        return False
    recomputed = _hash_password(password, salt_hex).split("$", 1)[1]
    return hmac.compare_digest(recomputed, digest_hex)


def _b64url_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode((data + padding).encode("ascii"))


def _jwt_sign(message: bytes) -> str:
    secret = JWT_SECRET.encode("utf-8")
    signature = hmac.new(secret, message, hashlib.sha256).digest()
    return _b64url_encode(signature)


def _build_user_record(email: str, password: str, name: str | None) -> dict:
    display_name = (name or email.split("@")[0].replace(".", " ").title()).strip()
    now = datetime.now(timezone.utc).isoformat()
    return {
        "email": email,
        "name": display_name,
        "password_hash": _hash_password(password),
        "created_at": now,
        "updated_at": now,
    }


def _issue_token(email: str, name: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": email,
        "name": name,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(hours=JWT_EXPIRE_HOURS)).timestamp()),
    }
    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    header_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature_b64 = _jwt_sign(signing_input)
    return f"{header_b64}.{payload_b64}.{signature_b64}"


def _decode_token(token: str) -> dict:
    try:
        header_b64, payload_b64, signature_b64 = token.split(".")
        header = json.loads(_b64url_decode(header_b64).decode("utf-8"))
        if header.get("alg") != JWT_ALGORITHM:
            raise HTTPException(status_code=401, detail="Invalid token.")

        signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
        expected_signature = _jwt_sign(signing_input)
        if not hmac.compare_digest(expected_signature, signature_b64):
            raise HTTPException(status_code=401, detail="Invalid token.")

        payload = json.loads(_b64url_decode(payload_b64).decode("utf-8"))
        exp = int(payload.get("exp", 0))
        if exp and exp < int(datetime.now(timezone.utc).timestamp()):
            raise HTTPException(status_code=401, detail="Session expired. Please login again.")
        return payload
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token.")
    except json.JSONDecodeError:
        raise HTTPException(status_code=401, detail="Invalid token.")


def _normalize_email(email: str) -> str:
    normalized = (email or "").strip().lower()
    if "@" not in normalized:
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    if not normalized.endswith(f"@{ALLOWED_EMAIL_DOMAIN}"):
        raise HTTPException(status_code=403, detail=f"Only @{ALLOWED_EMAIL_DOMAIN} accounts are permitted.")
    return normalized


@router.post("/signup")
async def signup(req: SignupRequest):
    email = _normalize_email(req.email)
    users = _load_users()
    if any(u.get("email") == email for u in users):
        raise HTTPException(status_code=409, detail="Account already exists. Please login.")

    user = _build_user_record(email, req.password, req.name)
    users.append(user)
    _save_users(users)
    token = _issue_token(user["email"], user["name"])

    return {
        "success": True,
        "token": token,
        "user": {"email": user["email"], "name": user["name"]},
    }


@router.post("/login")
async def login(req: LoginRequest):
    email = _normalize_email(req.email)
    users = _load_users()
    user = next((u for u in users if u.get("email") == email), None)
    if not user:
        raise HTTPException(status_code=404, detail="Account not found. Please sign up first.")

    if not _verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    user["updated_at"] = datetime.now(timezone.utc).isoformat()
    _save_users(users)
    token = _issue_token(user["email"], user["name"])

    return {
        "success": True,
        "token": token,
        "user": {"email": user["email"], "name": user["name"]},
    }


@router.get("/me")
async def me(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token.")
    token = authorization.split(" ", 1)[1].strip()
    payload = _decode_token(token)
    return {
        "email": payload.get("sub"),
        "name": payload.get("name"),
    }
