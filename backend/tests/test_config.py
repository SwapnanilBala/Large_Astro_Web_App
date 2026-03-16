import os
import unittest

from app.config import Settings


class SettingsTests(unittest.TestCase):
    def test_cors_origins_accepts_json_array(self) -> None:
        old_value = os.environ.get("CORS_ORIGINS")
        os.environ["CORS_ORIGINS"] = '["https://astro.example"]'

        try:
            self.assertEqual(Settings().cors_origins, ["https://astro.example"])
        finally:
            self._restore_env(old_value)

    def test_cors_origins_accepts_single_origin_string(self) -> None:
        old_value = os.environ.get("CORS_ORIGINS")
        os.environ["CORS_ORIGINS"] = "https://astro.example"

        try:
            self.assertEqual(Settings().cors_origins, ["https://astro.example"])
        finally:
            self._restore_env(old_value)

    def _restore_env(self, old_value: str | None) -> None:
        if old_value is None:
            os.environ.pop("CORS_ORIGINS", None)
        else:
            os.environ["CORS_ORIGINS"] = old_value


if __name__ == "__main__":
    unittest.main()
