"""Add SFTP auth table for password authentication

Revision ID: sftp_auth_001
Revises: 20250806_031422_add_activity_log_enhancement_columns
Create Date: 2025-01-08

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'sftp_auth_001'
down_revision = '20250806_031422_add_activity_log_enhancement_columns'
branch_labels = None
depends_on = None


def upgrade():
    # Create sftp_auth table
    op.create_table('sftp_auth',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('sftp_username', sa.String(length=50), nullable=False),
        sa.Column('sftp_password_hash', sa.String(length=255), nullable=True),
        sa.Column('ssh_public_key', sa.Text(), nullable=True),
        sa.Column('ssh_private_key', sa.Text(), nullable=True),
        sa.Column('auth_method', sa.String(length=20), nullable=True, server_default='ssh_key'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('last_sftp_login', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
        sa.UniqueConstraint('sftp_username')
    )
    
    # Create indexes
    op.create_index(op.f('ix_sftp_auth_sftp_username'), 'sftp_auth', ['sftp_username'], unique=True)


def downgrade():
    # Drop indexes
    op.drop_index(op.f('ix_sftp_auth_sftp_username'), table_name='sftp_auth')
    
    # Drop table
    op.drop_table('sftp_auth')