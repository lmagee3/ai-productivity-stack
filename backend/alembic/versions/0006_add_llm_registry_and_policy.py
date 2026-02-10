"""add llm registry and project policy

Revision ID: 0006_add_llm_registry_and_policy
Revises: 0005_add_brain_decisions
Create Date: 2026-02-10 01:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0006_add_llm_registry_and_policy"
down_revision = "0005_add_brain_decisions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "llm_providers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(length=64), nullable=False, unique=True),
        sa.Column("provider_type", sa.String(length=32), nullable=False),
        sa.Column("base_url", sa.String(length=255), nullable=True),
        sa.Column("model", sa.String(length=128), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.text("1")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )
    op.create_table(
        "project_llm_policy",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("project", sa.String(length=128), nullable=False, unique=True),
        sa.Column("default_provider", sa.String(length=64), nullable=False),
        sa.Column("allow_cloud", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )


def downgrade() -> None:
    op.drop_table("project_llm_policy")
    op.drop_table("llm_providers")
