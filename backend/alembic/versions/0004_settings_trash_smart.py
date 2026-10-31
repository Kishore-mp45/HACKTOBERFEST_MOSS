"""Runtime settings store, trash table, and smart collections.

Revision ID: 0004_settings_trash_smart
Revises: 0003_cluster_groups
"""

from sqlalchemy import inspect

from alembic import op
import sqlalchemy as sa

revision = "0004_settings_trash_smart"
down_revision = "0003_cluster_groups"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    tables = inspect(bind).get_table_names()
    if "settings" not in tables:
        op.create_table(
            "settings",
            sa.Column("key", sa.String(length=128), primary_key=True),
            sa.Column("value", sa.JSON(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        )
    if "trashed_files" not in tables:
        op.create_table(
            "trashed_files",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("workspace_id", sa.String(length=36), nullable=False),
            sa.Column("file_id", sa.String(length=36), nullable=True),
            sa.Column("original_path", sa.Text(), nullable=False),
            sa.Column("trash_path", sa.Text(), nullable=False),
            sa.Column("content_hash", sa.String(length=64), nullable=True),
            sa.Column("trashed_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("restored_at", sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(
                ["workspace_id"], ["workspaces.id"], ondelete="CASCADE"
            ),
        )
        op.create_index(
            "ix_trashed_files_workspace_id", "trashed_files", ["workspace_id"]
        )
    if "smart_collections" not in tables:
        op.create_table(
            "smart_collections",
            sa.Column("id", sa.String(length=36), primary_key=True),
            sa.Column("workspace_id", sa.String(length=36), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("query", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(
                ["workspace_id"], ["workspaces.id"], ondelete="CASCADE"
            ),
        )
        op.create_index(
            "ix_smart_collections_workspace_id",
            "smart_collections",
            ["workspace_id"],
        )


def downgrade() -> None:
    tables = inspect(op.get_bind()).get_table_names()
    for table in ("smart_collections", "trashed_files", "settings"):
        if table in tables:
            op.drop_table(table)
