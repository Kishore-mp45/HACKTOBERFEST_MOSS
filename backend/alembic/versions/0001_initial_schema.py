"""Create initial Moss application schema.

Revision ID: 0001_initial
Revises:
"""

from sqlalchemy import inspect

from alembic import op
from moss.models import Base

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind())
    columns = {column["name"] for column in inspect(op.get_bind()).get_columns("extractions")}
    if "metadata_json" not in columns:
        op.execute(
            "ALTER TABLE extractions "
            "ADD COLUMN metadata_json JSON NOT NULL DEFAULT '{}'"
        )


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())
