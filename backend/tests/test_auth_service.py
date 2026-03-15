import unittest
from copy import deepcopy
from datetime import datetime, timezone
from uuid import uuid4

from app.services.auth_service import AuthService


class FakeGateway:
    def __init__(self) -> None:
        self._users_by_id: dict[str, dict] = {}
        self._user_ids_by_email: dict[str, str] = {}

    def create_user(
        self,
        email: str,
        password_hash: str,
        display_name: str,
        subscription_tier: str = "guest",
    ) -> dict:
        normalized_email = email.strip().casefold()
        if normalized_email in self._user_ids_by_email:
            raise ValueError("An account with this email already exists.")

        user = {
            "user_id": str(uuid4()),
            "email": email,
            "password_hash": password_hash,
            "display_name": display_name,
            "subscription_tier": subscription_tier,
            "created_at": datetime.now(timezone.utc),
        }
        self._users_by_id[user["user_id"]] = user
        self._user_ids_by_email[normalized_email] = user["user_id"]
        return deepcopy(user)

    def find_user_by_email(self, email: str) -> dict | None:
        user_id = self._user_ids_by_email.get(email.strip().casefold())
        if not user_id:
            return None
        return deepcopy(self._users_by_id[user_id])

    def find_user_by_id(self, user_id: str) -> dict | None:
        user = self._users_by_id.get(user_id)
        if not user:
            return None
        return deepcopy(user)

    def update_user_subscription_tier(self, user_id: str, subscription_tier: str) -> dict | None:
        user = self._users_by_id.get(user_id)
        if not user:
            return None
        user["subscription_tier"] = subscription_tier
        return deepcopy(user)


class AuthServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        AuthService._redeem_attempts = {}
        self.gateway = FakeGateway()

        self.service = AuthService()
        self.service._gateway_factory = lambda: self.gateway
        self.service._plan_redemption_codes = {
            "basic": "BASIC-CODE",
            "pro": "PRO-CODE",
            "ultimate": "ULTIMATE-CODE",
        }
        self.service._redeem_cooldown_seconds = 5

    def test_register_defaults_to_guest_tier(self) -> None:
        result = self.service.register("guest@example.com", "pass1234", "Guest User")
        self.assertEqual(result["subscription_tier"], "guest")

    def test_redeem_plan_updates_subscription_tier(self) -> None:
        created = self.service.register("pro@example.com", "pass1234", "Pro User")

        redeemed = self.service.redeem_plan(created["user_id"], "PRO-CODE", "pro")

        self.assertEqual(redeemed["subscription_tier"], "pro")

    def test_redeem_plan_rejects_mismatched_plan(self) -> None:
        created = self.service.register("ultimate@example.com", "pass1234", "Ultimate User")

        with self.assertRaisesRegex(ValueError, "does not match the selected plan"):
            self.service.redeem_plan(created["user_id"], "ULTIMATE-CODE", "pro")

    def test_redeem_plan_rejects_immediate_retry(self) -> None:
        created = self.service.register("cooldown@example.com", "pass1234", "Cooldown User")
        self.service.redeem_plan(created["user_id"], "PRO-CODE", "pro")

        with self.assertRaisesRegex(ValueError, "Please wait"):
            self.service.redeem_plan(created["user_id"], "ULTIMATE-CODE", "ultimate")

    def test_reserved_ultimate_member_gets_ultimate_tier_on_register(self) -> None:
        created = self.service.register("swapnanil@example.com", "pass1234", "Swapnanil Bala")
        self.assertEqual(created["subscription_tier"], "ultimate")

    def test_reserved_ultimate_member_email_gets_ultimate_tier_on_register(self) -> None:
        created = self.service.register("arranfrost007@gmail.com", "pass1234", "Any Name")
        self.assertEqual(created["subscription_tier"], "ultimate")


if __name__ == "__main__":
    unittest.main()
