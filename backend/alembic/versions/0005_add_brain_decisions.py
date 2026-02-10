"""add brain decisions table

Revision ID: 0005_add_brain_decisions
Revises: 0004_add_chat_tables_tool_runs
Create Date: 2026-02-10 01:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0005_add_brain_decisions"
down_revision = "0004_add_chat_tables_tool_runs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "brain_decisions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("intent", sa.String(length=64), nullable=False),
        sa.Column("route_to", sa.String(length=32), nullable=False),
        sa.Column("actions_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )


def downgrade() -> None:
    op.drop_table("brain_decisions")
