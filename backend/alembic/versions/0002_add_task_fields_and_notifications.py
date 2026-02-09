"""add task fields and notifications

Revision ID: 0002_add_task_fields_and_notifications
Revises: 0001_create_tasks
Create Date: 2026-02-09 18:05:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0002_add_task_fields_and_notifications"
down_revision = "0001_create_tasks"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("tasks") as batch:
        batch.add_column(sa.Column("due_date", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("course", sa.String(length=255), nullable=True))
        batch.add_column(sa.Column("url", sa.String(length=2048), nullable=True))

    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("topic", sa.String(length=255), nullable=True),
        sa.Column("task_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("message", sa.String(length=2048), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
    )


def downgrade() -> None:
    op.drop_table("notifications")
    with op.batch_alter_table("tasks") as batch:
        batch.drop_column("url")
        batch.drop_column("course")
        batch.drop_column("due_date")
