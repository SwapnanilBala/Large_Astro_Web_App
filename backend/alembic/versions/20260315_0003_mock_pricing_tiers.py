"""Mock pricing tiers and defaults."""

from alembic import op
import sqlalchemy as sa


revision = "20260315_0003"
down_revision = "20260315_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE users
            SET subscription_tier = 'pro'
            WHERE subscription_tier IN ('premium', 'premium_trial')
            """
        )
    )
    op.alter_column(
        "users",
        "subscription_tier",
        existing_type=sa.String(length=32),
        server_default="basic",
        existing_nullable=False,
    )


def downgrade() -> None:
    op.execute(
        sa.text(
            """
            UPDATE users
            SET subscription_tier = 'premium'
            WHERE subscription_tier = 'pro'
            """
        )
    )
    op.alter_column(
        "users",
        "subscription_tier",
        existing_type=sa.String(length=32),
        server_default="premium",
        existing_nullable=False,
    )
