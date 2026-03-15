"""JWT authentication service using bcrypt + PyJWT."""

from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import get_settings
from app.db.session import get_mongo_database
from app.infrastructure.database_gateway import DatabaseGateway


class AuthService:
    _redeem_attempts: dict[str, datetime] = {}

    def __init__(self) -> None:
        self._settings = get_settings()
        self._secret = self._settings.jwt_secret
        self._algorithm = "HS256"
        self._expiry_days = 7
        self._gateway_factory = lambda: DatabaseGateway(get_mongo_database())
        self._plan_redemption_codes = {
            tier: code.strip().upper()
            for tier, code in self._settings.get_plan_redemption_codes().items()
        }
        self._redeem_cooldown_seconds = self._settings.plan_redeem_cooldown_seconds

    def _hash_password(self, password: str) -> str:
        return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    def _verify_password(self, password: str, hashed: str) -> bool:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))

    def _create_token(
        self,
        user_id: str,
        email: str,
        display_name: str,
        subscription_tier: str,
    ) -> str:
        payload = {
            "sub": user_id,
            "email": email,
            "display_name": display_name,
            "subscription_tier": subscription_tier,
            "exp": datetime.now(timezone.utc) + timedelta(days=self._expiry_days),
            "iat": datetime.now(timezone.utc),
        }
        return jwt.encode(payload, self._secret, algorithm=self._algorithm)

    def _check_redeem_cooldown(self, user_id: str) -> None:
        last_attempt = self._redeem_attempts.get(user_id)
        if not last_attempt:
            return

        elapsed = (datetime.now(timezone.utc) - last_attempt).total_seconds()
        if elapsed < self._redeem_cooldown_seconds:
            remaining = int(self._redeem_cooldown_seconds - elapsed)
            raise ValueError(
                f"Please wait {remaining or 1} more second(s) before trying another redemption."
            )

    def _record_redeem_attempt(self, user_id: str) -> None:
        self._redeem_attempts[user_id] = datetime.now(timezone.utc)

    def _resolve_subscription_tier(
        self,
        email: str,
        display_name: str,
        requested_tier: str = "guest",
    ) -> str:
        if self._settings.is_reserved_ultimate_member(
            display_name=display_name,
            email=email,
        ):
            return "ultimate"
        return requested_tier

    def register(self, email: str, password: str, display_name: str) -> dict:
        gateway = self._gateway_factory()
        existing = gateway.find_user_by_email(email)
        if existing:
            raise ValueError("An account with this email already exists.")

        password_hash = self._hash_password(password)
        subscription_tier = self._resolve_subscription_tier(email, display_name)
        user = gateway.create_user(
            email,
            password_hash,
            display_name,
            subscription_tier=subscription_tier,
        )

        token = self._create_token(
            user["user_id"],
            user["email"],
            user["display_name"],
            user["subscription_tier"],
        )
        return {
            **user,
            "token": token,
        }

    def login(self, email: str, password: str) -> dict | None:
        gateway = self._gateway_factory()
        user = gateway.find_user_by_email(email)
        if not user:
            return None

        if not self._verify_password(password, user["password_hash"]):
            return None

        effective_tier = self._resolve_subscription_tier(
            user["email"],
            user["display_name"],
            user["subscription_tier"],
        )
        if effective_tier != user["subscription_tier"]:
            user = gateway.update_user_subscription_tier(
                user["user_id"],
                effective_tier,
            )
            if not user:
                return None

        token = self._create_token(
            user["user_id"],
            user["email"],
            user["display_name"],
            user["subscription_tier"],
        )
        return {
            "user_id": user["user_id"],
            "email": user["email"],
            "display_name": user["display_name"],
            "subscription_tier": user["subscription_tier"],
            "token": token,
        }

    def redeem_plan(self, user_id: str, code: str, expected_plan: str | None = None) -> dict:
        self._check_redeem_cooldown(user_id)
        normalized_code = code.strip().upper()
        plan = next(
            (
                tier
                for tier, redemption_code in self._plan_redemption_codes.items()
                if redemption_code == normalized_code
            ),
            None,
        )
        self._record_redeem_attempt(user_id)

        if not plan:
            raise ValueError("That plan code is not valid.")

        if expected_plan and expected_plan != plan:
            raise ValueError("That code does not match the selected plan.")

        gateway = self._gateway_factory()
        current_user = gateway.find_user_by_id(user_id)
        if not current_user:
            raise ValueError("User account not found.")

        effective_plan = self._resolve_subscription_tier(
            current_user["email"],
            current_user["display_name"],
            plan,
        )
        user = gateway.update_user_subscription_tier(user_id, effective_plan)
        if not user:
            raise ValueError("User account not found.")

        token = self._create_token(
            user["user_id"],
            user["email"],
            user["display_name"],
            user["subscription_tier"],
        )
        return {
            **user,
            "token": token,
        }

    def verify_token(self, token: str) -> dict | None:
        try:
            payload = jwt.decode(token, self._secret, algorithms=[self._algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
