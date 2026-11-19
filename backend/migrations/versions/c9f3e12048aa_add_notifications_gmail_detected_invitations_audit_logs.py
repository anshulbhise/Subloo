"""add notifications, gmail detected subscriptions, organization invitations and audit logs

Revision ID: c9f3e12048aa
Revises: b8a6f5007144
Create Date: 2026-11-20 03:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c9f3e12048aa'
down_revision = 'b8a6f5007144'
branch_labels = None
depends_on = None


def table_exists(table_name):
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return insp.has_table(table_name)


def upgrade():
    # 1. notifications table
    if not table_exists('notifications'):
        op.create_table(
            'notifications',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('user_id', sa.String(length=36), nullable=False),
            sa.Column('organization_id', sa.String(length=36), nullable=True),
            sa.Column('type', sa.String(length=50), nullable=False),
            sa.Column('title', sa.String(length=180), nullable=False),
            sa.Column('message', sa.Text(), nullable=False),
            sa.Column('data', sa.JSON(), nullable=True),
            sa.Column('is_read', sa.Boolean(), nullable=False, server_default='0'),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('read_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_notifications_user_id'), 'notifications', ['user_id'], unique=False)
        op.create_index(op.f('ix_notifications_is_read'), 'notifications', ['is_read'], unique=False)
        op.create_index(op.f('ix_notifications_created_at'), 'notifications', ['created_at'], unique=False)

    # 2. gmail_detected_subscriptions table
    if not table_exists('gmail_detected_subscriptions'):
        op.create_table(
            'gmail_detected_subscriptions',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('user_id', sa.String(length=36), nullable=False),
            sa.Column('gmail_connection_id', sa.String(length=36), nullable=True),
            sa.Column('detected_provider', sa.String(length=180), nullable=False),
            sa.Column('detected_amount', sa.Numeric(precision=14, scale=2), nullable=False),
            sa.Column('detected_currency', sa.String(length=3), nullable=False, server_default='INR'),
            sa.Column('detected_billing_interval', sa.String(length=20), nullable=False, server_default='monthly'),
            sa.Column('email_subject', sa.String(length=300), nullable=True),
            sa.Column('email_sender', sa.String(length=200), nullable=True),
            sa.Column('email_date', sa.Date(), nullable=True),
            sa.Column('confidence', sa.Float(), nullable=False, server_default='0.85'),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['gmail_connection_id'], ['gmail_connections.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_gmail_detected_subscriptions_user_id'), 'gmail_detected_subscriptions', ['user_id'], unique=False)

    # 3. organization_invitations table
    if not table_exists('organization_invitations'):
        op.create_table(
            'organization_invitations',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('organization_id', sa.String(length=36), nullable=False),
            sa.Column('email', sa.String(length=255), nullable=False),
            sa.Column('role', sa.String(length=30), nullable=False, server_default='member'),
            sa.Column('invited_by_user_id', sa.String(length=36), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
            sa.Column('token', sa.String(length=100), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['invited_by_user_id'], ['users.id'], ondelete='RESTRICT'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('token')
        )
        op.create_index(op.f('ix_organization_invitations_organization_id'), 'organization_invitations', ['organization_id'], unique=False)
        op.create_index(op.f('ix_organization_invitations_email'), 'organization_invitations', ['email'], unique=False)

    # 4. organization_audit_logs table
    if not table_exists('organization_audit_logs'):
        op.create_table(
            'organization_audit_logs',
            sa.Column('id', sa.String(length=36), nullable=False),
            sa.Column('organization_id', sa.String(length=36), nullable=False),
            sa.Column('actor_user_id', sa.String(length=36), nullable=False),
            sa.Column('action', sa.String(length=100), nullable=False),
            sa.Column('target_type', sa.String(length=50), nullable=True),
            sa.Column('target_id', sa.String(length=36), nullable=True),
            sa.Column('details', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['actor_user_id'], ['users.id'], ondelete='RESTRICT'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_organization_audit_logs_organization_id'), 'organization_audit_logs', ['organization_id'], unique=False)


def downgrade():
    if table_exists('organization_audit_logs'):
        op.drop_table('organization_audit_logs')
    if table_exists('organization_invitations'):
        op.drop_table('organization_invitations')
    if table_exists('gmail_detected_subscriptions'):
        op.drop_table('gmail_detected_subscriptions')
    if table_exists('notifications'):
        op.drop_table('notifications')
