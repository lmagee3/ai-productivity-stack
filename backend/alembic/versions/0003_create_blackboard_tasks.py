"""create blackboard tasks table

Revision ID: 0003_create_blackboard_tasks
Revises: 0002_add_task_fields_and_notifications
Create Date: 2026-02-10 00:10:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0003_create_blackboard_tasks"
down_revision = "0002_add_task_fields_and_notifications"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "blackboard_tasks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("course", sa.String(length=255), nullable=True),
        sa.Column("url", sa.String(length=2048), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="not_submitted"),
        sa.Column("points", sa.Float(), nullable=True),
        sa.Column("priority", sa.String(length=16), nullable=False, server_default="low"),
        sa.Column("urgency_score", sa.Float(), nullable=False, server_default="0.1"),
        sa.Column("source", sa.String(length=64), nullable=False, server_default="Blackboard"),
    )


def downgrade() -> None:
    op.drop_table("blackboard_tasks")
