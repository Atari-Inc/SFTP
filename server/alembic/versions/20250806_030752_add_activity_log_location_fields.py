"""Add activity log location fields

Revision ID: 20250806_030752
Revises: 
Create Date: 2025-08-06 03:07:52.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250806_030752'
down_revision = None  # Update this to the previous migration ID if there are others
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add new columns to activity_logs table"""
    # Add file path and location columns
    op.add_column('activity_logs', sa.Column('file_path', sa.String(length=1000), nullable=True))
    op.add_column('activity_logs', sa.Column('location_country', sa.String(length=100), nullable=True))
    op.add_column('activity_logs', sa.Column('location_city', sa.String(length=100), nullable=True))
    op.add_column('activity_logs', sa.Column('location_region', sa.String(length=100), nullable=True))


def downgrade() -> None:
    """Remove the added columns"""
    op.drop_column('activity_logs', 'location_region')
    op.drop_column('activity_logs', 'location_city')
    op.drop_column('activity_logs', 'location_country')
    op.drop_column('activity_logs', 'file_path')