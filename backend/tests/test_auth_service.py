import unittest

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.db.models  # noqa: F401
from app.db.base import Base
from app.services.auth_service import AuthService


class AuthServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        engine = create_engine("sqlite:///:memory:", future=True)
        Base.metadata.create_all(engine)
        self.session_factory = sessionmaker(bind=engine, expire_on_commit=False, future=True)
        AuthService._redeem_attempts = {}

        self.service = AuthService()
        self.service._session_factory = self.session_factory
        self.service._plan_redemption_codes = {
            "basic": "BASIC-CODE",
            "pro": "PRO-CODE",
            "ultimate": "ULTIMATE-CODE",
        }
        self.service._redeem_cooldown_seconds = 5

    def test_register_defaults_to_basic_tier(self) -> None:
        result = self.service.register("basic@example.com", "pass1234", "Basic User")
        self.assertEqual(result["subscription_tier"], "basic")

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
