"""Workspace, premium, and compatibility schema."""

from alembic import op
import sqlalchemy as sa


revision = "20260315_0002"
down_revision = "20260315_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("time_zone_id", sa.String(length=120), server_default="", nullable=False))

    op.add_column("users", sa.Column("subscription_tier", sa.String(length=32), server_default="premium", nullable=False))

    op.drop_constraint("uq_saved_charts_user_profile", "saved_charts", type_="unique")
    op.add_column("saved_charts", sa.Column("birth_time", sa.String(length=32), server_default="", nullable=False))
    op.add_column("saved_charts", sa.Column("timezone_offset_minutes", sa.Integer(), server_default="0", nullable=False))
    op.add_column("saved_charts", sa.Column("country", sa.String(length=120), server_default="", nullable=False))
    op.add_column("saved_charts", sa.Column("state", sa.String(length=120), server_default="", nullable=False))
    op.add_column("saved_charts", sa.Column("town", sa.String(length=120), server_default="", nullable=False))
    op.add_column("saved_charts", sa.Column("latitude", sa.Float(), server_default="0", nullable=False))
    op.add_column("saved_charts", sa.Column("longitude", sa.Float(), server_default="0", nullable=False))
    op.add_column("saved_charts", sa.Column("time_zone_id", sa.String(length=120), server_default="", nullable=False))
    op.add_column("saved_charts", sa.Column("notes", sa.Text(), server_default="", nullable=False))
    op.add_column("saved_charts", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False))
    op.create_unique_constraint(
        "uq_saved_charts_user_profile",
        "saved_charts",
        ["user_id", "name", "birth_date", "birth_time"],
    )

    op.create_table(
        "saved_comparisons",
        sa.Column("saved_comparison_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("primary_name", sa.String(length=120), nullable=False),
        sa.Column("partner_name", sa.String(length=120), nullable=False),
        sa.Column("compatibility_score", sa.Float(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("query_string", sa.Text(), nullable=False),
        sa.Column("report_json", sa.JSON(), nullable=False),
        sa.Column("notes", sa.Text(), server_default="", nullable=False),
        sa.Column("saved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("saved_comparison_id"),
    )
    op.create_index("ix_saved_comparisons_user_id", "saved_comparisons", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_saved_comparisons_user_id", table_name="saved_comparisons")
    op.drop_table("saved_comparisons")

    op.drop_constraint("uq_saved_charts_user_profile", "saved_charts", type_="unique")
    op.drop_column("saved_charts", "updated_at")
    op.drop_column("saved_charts", "notes")
    op.drop_column("saved_charts", "time_zone_id")
    op.drop_column("saved_charts", "longitude")
    op.drop_column("saved_charts", "latitude")
    op.drop_column("saved_charts", "town")
    op.drop_column("saved_charts", "state")
    op.drop_column("saved_charts", "country")
    op.drop_column("saved_charts", "timezone_offset_minutes")
    op.drop_column("saved_charts", "birth_time")
    op.create_unique_constraint(
        "uq_saved_charts_user_profile",
        "saved_charts",
        ["user_id", "name", "birth_date"],
    )

    op.drop_column("users", "subscription_tier")
    op.drop_column("clients", "time_zone_id")
