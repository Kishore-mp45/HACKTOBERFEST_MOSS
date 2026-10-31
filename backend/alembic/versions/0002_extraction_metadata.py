"""Persist parser document metadata.

Revision ID: 0002_extraction_metadata
Revises: 0001_initial
"""

from sqlalchemy import inspect

from alembic import op

revision = "0002_extraction_metadata"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in inspect(op.get_bind()).get_columns("extractions")}
    if "metadata_json" not in columns:
        op.execute(
            "ALTER TABLE extractions "
            "ADD COLUMN metadata_json JSON NOT NULL DEFAULT '{}'"
        )


def downgrade() -> None:
    columns = {column["name"] for column in inspect(op.get_bind()).get_columns("extractions")}
    if "metadata_json" in columns:
        op.drop_column("extractions", "metadata_json")
