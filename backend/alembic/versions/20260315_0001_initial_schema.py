"""Initial application schema."""

from alembic import op
import sqlalchemy as sa


revision = "20260315_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "clients",
        sa.Column("client_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("birth_date", sa.Date(), nullable=False),
        sa.Column("birth_time", sa.String(length=32), nullable=False),
        sa.Column("timezone_offset_minutes", sa.Integer(), nullable=False),
        sa.Column("country", sa.String(length=120), nullable=False),
        sa.Column("state", sa.String(length=120), nullable=False),
        sa.Column("city", sa.String(length=120), nullable=False),
        sa.Column("town", sa.String(length=120), nullable=False),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("client_id"),
    )
    op.create_index("ix_clients_name", "clients", ["name"], unique=False)

    op.create_table(
        "users",
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("user_id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "past_interactions",
        sa.Column("interaction_id", sa.String(length=36), nullable=False),
        sa.Column("client_id", sa.String(length=36), nullable=False),
        sa.Column("request_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("request_type", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.client_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("interaction_id"),
    )
    op.create_index("ix_past_interactions_client_id", "past_interactions", ["client_id"], unique=False)

    op.create_table(
        "findings",
        sa.Column("finding_id", sa.String(length=36), nullable=False),
        sa.Column("client_id", sa.String(length=36), nullable=False),
        sa.Column("interaction_id", sa.String(length=36), nullable=False),
        sa.Column("julian_day_ut", sa.Float(), nullable=False),
        sa.Column("ascendant_sign", sa.String(length=32), nullable=False),
        sa.Column("ascendant_longitude", sa.Float(), nullable=False),
        sa.Column("ascendant_degree_in_sign", sa.Float(), nullable=False),
        sa.Column("planets_json", sa.JSON(), nullable=False),
        sa.Column("houses_json", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.client_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["interaction_id"], ["past_interactions.interaction_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("finding_id"),
    )
    op.create_index("ix_findings_client_id", "findings", ["client_id"], unique=False)
    op.create_index("ix_findings_interaction_id", "findings", ["interaction_id"], unique=False)

    op.create_table(
        "readings",
        sa.Column("reading_id", sa.String(length=36), nullable=False),
        sa.Column("client_id", sa.String(length=36), nullable=False),
        sa.Column("interaction_id", sa.String(length=36), nullable=False),
        sa.Column("rule_title", sa.String(length=255), nullable=False),
        sa.Column("rule_insight", sa.Text(), nullable=False),
        sa.Column("rule_basis", sa.Text(), nullable=False),
        sa.Column("rule_priority", sa.String(length=16), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.client_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["interaction_id"], ["past_interactions.interaction_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("reading_id"),
    )
    op.create_index("ix_readings_client_id", "readings", ["client_id"], unique=False)
    op.create_index("ix_readings_interaction_id", "readings", ["interaction_id"], unique=False)

    op.create_table(
        "future_predictions",
        sa.Column("prediction_id", sa.String(length=36), nullable=False),
        sa.Column("client_id", sa.String(length=36), nullable=False),
        sa.Column("interaction_id", sa.String(length=36), nullable=False),
        sa.Column("summary", sa.Text(), nullable=False),
        sa.Column("dominant_element", sa.Text(), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["client_id"], ["clients.client_id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["interaction_id"], ["past_interactions.interaction_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("prediction_id"),
    )
    op.create_index("ix_future_predictions_client_id", "future_predictions", ["client_id"], unique=False)
    op.create_index("ix_future_predictions_interaction_id", "future_predictions", ["interaction_id"], unique=False)

    op.create_table(
        "saved_charts",
        sa.Column("saved_chart_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("city", sa.String(length=120), nullable=False),
        sa.Column("birth_date", sa.Date(), nullable=False),
        sa.Column("ascendant_sign", sa.String(length=32), nullable=False),
        sa.Column("query_string", sa.Text(), nullable=False),
        sa.Column("saved_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("saved_chart_id"),
        sa.UniqueConstraint("user_id", "name", "birth_date", name="uq_saved_charts_user_profile"),
    )
    op.create_index("ix_saved_charts_user_id", "saved_charts", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_saved_charts_user_id", table_name="saved_charts")
    op.drop_table("saved_charts")
    op.drop_index("ix_future_predictions_interaction_id", table_name="future_predictions")
    op.drop_index("ix_future_predictions_client_id", table_name="future_predictions")
    op.drop_table("future_predictions")
    op.drop_index("ix_readings_interaction_id", table_name="readings")
    op.drop_index("ix_readings_client_id", table_name="readings")
    op.drop_table("readings")
    op.drop_index("ix_findings_interaction_id", table_name="findings")
    op.drop_index("ix_findings_client_id", table_name="findings")
    op.drop_table("findings")
    op.drop_index("ix_past_interactions_client_id", table_name="past_interactions")
    op.drop_table("past_interactions")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
    op.drop_index("ix_clients_name", table_name="clients")
    op.drop_table("clients")
