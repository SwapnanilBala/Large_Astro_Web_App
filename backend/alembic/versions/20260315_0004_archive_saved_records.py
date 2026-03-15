"""Add archive state to saved records."""

from alembic import op
import sqlalchemy as sa


revision = "20260315_0004"
down_revision = "20260315_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("saved_charts", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("saved_comparisons", sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("saved_comparisons", "archived_at")
    op.drop_column("saved_charts", "archived_at")
