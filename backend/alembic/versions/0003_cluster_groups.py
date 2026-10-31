"""Persist LLM-refined cluster group names.

Revision ID: 0003_cluster_groups
Revises: 0002_extraction_metadata
"""

from sqlalchemy import inspect

from alembic import op
import sqlalchemy as sa

revision = "0003_cluster_groups"
down_revision = "0002_extraction_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    if "cluster_groups" in inspect(bind).get_table_names():
        return
    op.create_table(
        "cluster_groups",
        sa.Column("cluster_id", sa.String(length=512), primary_key=True),
        sa.Column("workspace_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("confidence", sa.String(length=16), nullable=False, server_default="medium"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["workspace_id"], ["workspaces.id"], ondelete="CASCADE"
        ),
    )
    op.create_index(
        "ix_cluster_groups_workspace_id", "cluster_groups", ["workspace_id"]
    )


def downgrade() -> None:
    if "cluster_groups" in inspect(op.get_bind()).get_table_names():
        op.drop_table("cluster_groups")
