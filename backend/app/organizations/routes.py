import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from flask import Blueprint, jsonify, request
from app.common.auth import get_current_user_id, login_required, trusted_origin
from app.database.extensions import db
from app.organizations.models import Organization, OrganizationMembership, OrganizationInvitation, OrganizationAuditLog
from app.teams.models import Team, TeamMembership
from app.subscriptions.models import Subscription
from app.users.models import User
from app.preprocessing.service import calculate_monthly_cost


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def slugify(text):
    clean = re.sub(r"[^\w\s-]", "", str(text or "").strip().lower())
    return re.sub(r"[-\s]+", "-", clean) or "org"


organizations_bp = Blueprint(
    "organizations",
    __name__,
    url_prefix="/api/organizations"
)


def get_user_org_membership(user_id, organization_id):
    """Retrieve user membership record for an organization."""
    return OrganizationMembership.query.filter_by(
        user_id=user_id,
        organization_id=organization_id,
        status="active"
    ).first()


def record_audit(org_id, actor_id, action, target_type=None, target_id=None, details=None):
    """Log an organizational audit event."""
    try:
        log = OrganizationAuditLog(
            organization_id=org_id,
            actor_user_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details or {},
            created_at=utc_now()
        )
        db.session.add(log)
        db.session.commit()
    except Exception:
        db.session.rollback()


# --------------------------------------------------
# 1. LIST ORGANIZATIONS FOR CURRENT USER
# --------------------------------------------------
@organizations_bp.route("", methods=["GET"])
@login_required
def list_organizations():
    user_id = get_current_user_id()
    user = db.session.get(User, user_id)

    memberships = (
        OrganizationMembership.query.filter_by(user_id=user_id, status="active")
        .join(Organization)
        .order_by(Organization.created_at.desc())
        .all()
    )

    org_list = []
    for m in memberships:
        org = m.organization
        member_count = OrganizationMembership.query.filter_by(organization_id=org.id, status="active").count()
        team_count = Team.query.filter_by(organization_id=org.id, status="active").count()
        sub_count = Subscription.query.filter_by(organization_id=org.id).count()

        org_list.append({
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "legal_name": org.legal_name,
            "role": m.role,
            "joined_at": m.joined_at.isoformat() if m.joined_at else None,
            "member_count": member_count,
            "team_count": team_count,
            "subscription_count": sub_count,
        })

    # Also list pending invitations for user's email
    pending_invites = []
    if user and user.email:
        invites = OrganizationInvitation.query.filter_by(
            email=user.email.lower(),
            status="pending"
        ).all()
        pending_invites = [inv.to_dict() for inv in invites]

    return jsonify({
        "status": "success",
        "count": len(org_list),
        "organizations": org_list,
        "pending_invitations": pending_invites,
    }), 200


# --------------------------------------------------
# 2. CREATE A NEW ORGANIZATION
# --------------------------------------------------
@organizations_bp.route("", methods=["POST"])
@login_required
def create_organization():
    user_id = get_current_user_id()
    data = request.get_json(silent=True) or {}

    name = str(data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Organization name is required."}), 400

    base_slug = slugify(data.get("slug") or name)
    # Ensure unique slug
    slug = base_slug
    counter = 1
    while Organization.query.filter_by(slug=slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    org = Organization(
        name=name,
        slug=slug,
        legal_name=str(data.get("legal_name") or "").strip() or None,
        created_by_user_id=user_id,
        status="active",
        created_at=utc_now(),
    )
    db.session.add(org)
    db.session.flush()

    # Creator becomes Owner
    membership = OrganizationMembership(
        organization_id=org.id,
        user_id=user_id,
        role="owner",
        status="active",
        joined_at=utc_now(),
    )
    db.session.add(membership)
    db.session.commit()

    record_audit(
        org.id,
        user_id,
        "organization_created",
        target_type="organization",
        target_id=org.id,
        details={"name": name, "slug": slug}
    )

    return jsonify({
        "status": "success",
        "message": "Organization created successfully.",
        "organization": {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "role": "owner"
        }
    }), 201


# --------------------------------------------------
# 3. GET ORGANIZATION DETAILS
# --------------------------------------------------
@organizations_bp.route("/<string:org_id>", methods=["GET"])
@login_required
def get_organization(org_id):
    user_id = get_current_user_id()
    membership = get_user_org_membership(user_id, org_id)

    if not membership:
        return jsonify({"error": "Access denied. You are not a member of this organization."}), 403

    org = db.session.get(Organization, org_id)
    if not org or org.status != "active":
        return jsonify({"error": "Organization not found."}), 404

    member_count = OrganizationMembership.query.filter_by(organization_id=org.id, status="active").count()
    team_count = Team.query.filter_by(organization_id=org.id, status="active").count()
    sub_count = Subscription.query.filter_by(organization_id=org.id).count()

    return jsonify({
        "status": "success",
        "organization": {
            "id": org.id,
            "name": org.name,
            "slug": org.slug,
            "legal_name": org.legal_name,
            "role": membership.role,
            "member_count": member_count,
            "team_count": team_count,
            "subscription_count": sub_count,
            "created_at": org.created_at.isoformat() if org.created_at else None,
        }
    }), 200


# --------------------------------------------------
# 4. UPDATE ORGANIZATION DETAILS (OWNER / ADMIN ONLY)
# --------------------------------------------------
@organizations_bp.route("/<string:org_id>", methods=["PUT"])
@login_required
def update_organization(org_id):
    user_id = get_current_user_id()
    membership = get_user_org_membership(user_id, org_id)

    if not membership or membership.role not in {"owner", "admin"}:
        return jsonify({"error": "Only organization owners and admins can edit organization details."}), 403

    org = db.session.get(Organization, org_id)
    if not org:
        return jsonify({"error": "Organization not found."}), 404

    data = request.get_json(silent=True) or {}
    if "name" in data:
        name = str(data["name"]).strip()
        if name:
            org.name = name
    if "legal_name" in data:
        org.legal_name = str(data["legal_name"]).strip() or None

    db.session.commit()
    record_audit(org.id, user_id, "organization_updated", target_type="organization", target_id=org.id)

    return jsonify({
        "status": "success",
        "message": "Organization updated.",
        "organization": {
            "id": org.id,
            "name": org.name,
            "legal_name": org.legal_name,
        }
    }), 200


# --------------------------------------------------
# 5. LIST MEMBERS
# --------------------------------------------------
@organizations_bp.route("/<string:org_id>/members", methods=["GET"])
@login_required
def list_org_members(org_id):
    user_id = get_current_user_id()
    membership = get_user_org_membership(user_id, org_id)

    if not membership:
        return jsonify({"error": "Access denied."}), 403

    memberships = (
        OrganizationMembership.query.filter_by(organization_id=org_id, status="active")
        .join(User)
        .order_by(OrganizationMembership.joined_at.asc())
        .all()
    )

    members = []
    for m in memberships:
        members.append({
            "membership_id": m.id,
            "user_id": m.user_id,
            "full_name": m.user.full_name,
            "email": m.user.email,
            "role": m.role,
            "joined_at": m.joined_at.isoformat() if m.joined_at else None,
        })

    return jsonify({
        "status": "success",
        "count": len(members),
        "members": members
    }), 200


# --------------------------------------------------
# 6. INVITE MEMBER
# --------------------------------------------------
@organizations_bp.route("/<string:org_id>/invitations", methods=["POST"])
@login_required
def invite_member(org_id):
    user_id = get_current_user_id()
    membership = get_user_org_membership(user_id, org_id)

    if not membership or membership.role not in {"owner", "admin", "office_manager"}:
        return jsonify({"error": "You do not have permission to invite members."}), 403

    data = request.get_json(silent=True) or {}
    email = str(data.get("email") or "").strip().lower()
    role = str(data.get("role") or "member").strip().lower()

    if not email or "@" not in email:
        return jsonify({"error": "Valid email address is required."}), 400

    valid_roles = {"admin", "office_manager", "member"}
    if role not in valid_roles:
        return jsonify({"error": f"Role must be one of: {', '.join(sorted(valid_roles))}"}), 400

    # Prevent non-owners from inviting admins
    if role == "admin" and membership.role != "owner":
        return jsonify({"error": "Only the organization owner can invite administrators."}), 403

    org = db.session.get(Organization, org_id)
    if not org:
        return jsonify({"error": "Organization not found."}), 404

    # Check if user is already a member
    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        existing_mem = OrganizationMembership.query.filter_by(
            organization_id=org_id,
            user_id=existing_user.id,
            status="active"
        ).first()
        if existing_mem:
            return jsonify({"error": "This user is already an active member of this organization."}), 409

    # Create or update pending invitation
    invitation = OrganizationInvitation.query.filter_by(
        organization_id=org_id,
        email=email,
        status="pending"
    ).first()

    if not invitation:
        invitation = OrganizationInvitation(
            organization_id=org_id,
            email=email,
            role=role,
            invited_by_user_id=user_id,
            status="pending",
            created_at=utc_now(),
        )
        db.session.add(invitation)
    else:
        invitation.role = role

    db.session.commit()

    # If the user already exists, notify them
    if existing_user:
        try:
            from app.notifications.service import create_notification
            create_notification(
                user_id=existing_user.id,
                notif_type="organization_invitation",
                title=f"Invitation to {org.name}",
                message=f"You have been invited to join {org.name} as {role.replace('_', ' ').title()}.",
                data={"organization_id": org.id, "invitation_id": invitation.id, "role": role}
            )
        except Exception:
            pass

    record_audit(
        org_id,
        user_id,
        "member_invited",
        target_type="invitation",
        target_id=invitation.id,
        details={"email": email, "role": role}
    )

    return jsonify({
        "status": "success",
        "message": f"Invitation sent to {email}.",
        "invitation": invitation.to_dict()
    }), 201


# --------------------------------------------------
# 7. ACCEPT / REJECT INVITATION
# --------------------------------------------------
@organizations_bp.route("/invitations/<string:invitation_id>/accept", methods=["POST"])
@login_required
def accept_invitation(invitation_id):
    user_id = get_current_user_id()
    user = db.session.get(User, user_id)

    invitation = db.session.get(OrganizationInvitation, invitation_id)
    if not invitation or invitation.status != "pending":
        return jsonify({"error": "Invitation not found or no longer pending."}), 404

    if invitation.email.lower() != user.email.lower():
        return jsonify({"error": "This invitation was sent to a different email address."}), 403

    # Add membership
    membership = OrganizationMembership.query.filter_by(
        organization_id=invitation.organization_id,
        user_id=user_id
    ).first()

    if not membership:
        membership = OrganizationMembership(
            organization_id=invitation.organization_id,
            user_id=user_id,
            role=invitation.role,
            status="active",
            joined_at=utc_now(),
        )
        db.session.add(membership)
    else:
        membership.status = "active"
        membership.role = invitation.role

    invitation.status = "accepted"
    db.session.commit()

    record_audit(
        invitation.organization_id,
        user_id,
        "member_joined",
        target_type="user",
        target_id=user_id,
        details={"role": invitation.role}
    )

    return jsonify({
        "status": "success",
        "message": f"You have joined {invitation.organization.name} successfully."
    }), 200


@organizations_bp.route("/invitations/<string:invitation_id>/reject", methods=["POST"])
@login_required
def reject_invitation(invitation_id):
    user_id = get_current_user_id()
    user = db.session.get(User, user_id)

    invitation = db.session.get(OrganizationInvitation, invitation_id)
    if not invitation or invitation.status != "pending":
        return jsonify({"error": "Invitation not found or no longer pending."}), 404

    if invitation.email.lower() != user.email.lower():
        return jsonify({"error": "Access denied."}), 403

    invitation.status = "rejected"
    db.session.commit()

    return jsonify({
        "status": "success",
        "message": "Invitation rejected."
    }), 200


# --------------------------------------------------
# 8. CHANGE MEMBER ROLE
# --------------------------------------------------
@organizations_bp.route("/<string:org_id>/members/<string:target_user_id>", methods=["PUT"])
@login_required
def update_member_role(org_id, target_user_id):
    user_id = get_current_user_id()
    caller_mem = get_user_org_membership(user_id, org_id)

    if not caller_mem or caller_mem.role not in {"owner", "admin"}:
        return jsonify({"error": "Only owners and admins can update member roles."}), 403

    target_mem = get_user_org_membership(target_user_id, org_id)
    if not target_mem:
        return jsonify({"error": "Member not found in this organization."}), 404

    if target_mem.role == "owner" and caller_mem.role != "owner":
        return jsonify({"error": "Cannot change the role of the organization owner."}), 403

    data = request.get_json(silent=True) or {}
    new_role = str(data.get("role") or "").strip().lower()

    valid_roles = {"admin", "office_manager", "member"}
    if new_role not in valid_roles:
        return jsonify({"error": f"Role must be one of: {', '.join(sorted(valid_roles))}"}), 400

    old_role = target_mem.role
    target_mem.role = new_role
    db.session.commit()

    record_audit(
        org_id,
        user_id,
        "role_changed",
        target_type="user",
        target_id=target_user_id,
        details={"old_role": old_role, "new_role": new_role}
    )

    return jsonify({
        "status": "success",
        "message": f"Updated member role to {new_role}."
    }), 200


# --------------------------------------------------
# 9. REMOVE MEMBER
# --------------------------------------------------
@organizations_bp.route("/<string:org_id>/members/<string:target_user_id>", methods=["DELETE"])
@login_required
def remove_member(org_id, target_user_id):
    user_id = get_current_user_id()
    caller_mem = get_user_org_membership(user_id, org_id)

    # Allow a user to leave, or owners/admins to remove members
    is_self = user_id == target_user_id
    if not is_self and (not caller_mem or caller_mem.role not in {"owner", "admin"}):
        return jsonify({"error": "Permission denied."}), 403

    target_mem = get_user_org_membership(target_user_id, org_id)
    if not target_mem:
        return jsonify({"error": "Member not found in this organization."}), 404

    if target_mem.role == "owner":
        return jsonify({"error": "Cannot remove the organization owner."}), 400

    target_mem.status = "removed"
    db.session.commit()

    record_audit(
        org_id,
        user_id,
        "member_removed",
        target_type="user",
        target_id=target_user_id
    )

    return jsonify({
        "status": "success",
        "message": "Member removed from organization."
    }), 200


# --------------------------------------------------
# 10. TEAMS MANAGEMENT
# --------------------------------------------------
@organizations_bp.route("/<string:org_id>/teams", methods=["GET"])
@login_required
def list_teams(org_id):
    user_id = get_current_user_id()
    membership = get_user_org_membership(user_id, org_id)

    if not membership:
        return jsonify({"error": "Access denied."}), 403

    teams = Team.query.filter_by(organization_id=org_id, status="active").all()
    result = []
    for t in teams:
        members_count = TeamMembership.query.filter_by(team_id=t.id).count()
        result.append({
            "id": t.id,
            "name": t.name,
            "description": t.description,
            "manager_name": t.manager.full_name if t.manager else "Unassigned",
            "members_count": members_count,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        })

    return jsonify({
        "status": "success",
        "count": len(result),
        "teams": result
    }), 200


@organizations_bp.route("/<string:org_id>/teams", methods=["POST"])
@login_required
def create_team(org_id):
    user_id = get_current_user_id()
    membership = get_user_org_membership(user_id, org_id)

    if not membership or membership.role not in {"owner", "admin", "office_manager"}:
        return jsonify({"error": "Permission denied. Only managers and admins can create teams."}), 403

    data = request.get_json(silent=True) or {}
    name = str(data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Team name is required."}), 400

    team = Team(
        organization_id=org_id,
        name=name,
        description=str(data.get("description") or "").strip() or None,
        manager_user_id=data.get("manager_user_id") or user_id,
        status="active",
        created_at=utc_now(),
    )
    db.session.add(team)
    db.session.commit()

    record_audit(org_id, user_id, "team_created", target_type="team", target_id=team.id, details={"name": name})

    return jsonify({
        "status": "success",
        "message": f"Team '{name}' created successfully.",
        "team": {
            "id": team.id,
            "name": team.name,
            "description": team.description,
        }
    }), 201


@organizations_bp.route("/<string:org_id>/teams/<string:team_id>", methods=["PUT"])
@login_required
def update_team(org_id, team_id):
    user_id = get_current_user_id()
    membership = get_user_org_membership(user_id, org_id)

    if not membership or membership.role not in {"owner", "admin", "office_manager"}:
        return jsonify({"error": "Permission denied."}), 403

    team = Team.query.filter_by(id=team_id, organization_id=org_id).first()
    if not team:
        return jsonify({"error": "Team not found."}), 404

    data = request.get_json(silent=True) or {}
    if "name" in data:
        name = str(data["name"]).strip()
        if name:
            team.name = name
    if "description" in data:
        team.description = str(data["description"]).strip() or None
    if "manager_user_id" in data:
        team.manager_user_id = data["manager_user_id"] or None

    db.session.commit()
    record_audit(org_id, user_id, "team_updated", target_type="team", target_id=team.id)

    return jsonify({
        "status": "success",
        "message": "Team updated.",
        "team": {
            "id": team.id,
            "name": team.name,
            "description": team.description,
        }
    }), 200


@organizations_bp.route("/<string:org_id>/teams/<string:team_id>", methods=["DELETE"])
@login_required
def delete_team(org_id, team_id):
    user_id = get_current_user_id()
    membership = get_user_org_membership(user_id, org_id)

    if not membership or membership.role not in {"owner", "admin", "office_manager"}:
        return jsonify({"error": "Permission denied."}), 403

    team = Team.query.filter_by(id=team_id, organization_id=org_id).first()
    if not team:
        return jsonify({"error": "Team not found."}), 404

    team_name = team.name
    db.session.delete(team)
    db.session.commit()

    record_audit(org_id, user_id, "team_deleted", target_type="team", target_id=team_id, details={"name": team_name})

    return jsonify({
        "status": "success",
        "message": f"Team '{team_name}' deleted."
    }), 200


# --------------------------------------------------
# 11. TEAM MEMBERS ASSIGNMENT
# --------------------------------------------------
@organizations_bp.route("/<string:org_id>/teams/<string:team_id>/members", methods=["GET"])
@login_required
def list_team_members(org_id, team_id):
    user_id = get_current_user_id()
    membership = get_user_org_membership(user_id, org_id)

    if not membership:
        return jsonify({"error": "Access denied."}), 403

    memberships = TeamMembership.query.filter_by(team_id=team_id).all()
    members = []
    for m in memberships:
        members.append({
            "membership_id": m.id,
            "user_id": m.user_id,
            "full_name": m.user.full_name if m.user else "User",
            "email": m.user.email if m.user else "",
            "assigned_at": m.assigned_at.isoformat() if m.assigned_at else None,
        })

    return jsonify({
        "status": "success",
        "count": len(members),
        "members": members
    }), 200


@organizations_bp.route("/<string:org_id>/teams/<string:team_id>/members", methods=["POST"])
@login_required
def add_team_member(org_id, team_id):
    user_id = get_current_user_id()
    membership = get_user_org_membership(user_id, org_id)

    if not membership or membership.role not in {"owner", "admin", "office_manager"}:
        return jsonify({"error": "Permission denied."}), 403

    team = Team.query.filter_by(id=team_id, organization_id=org_id).first()
    if not team:
        return jsonify({"error": "Team not found."}), 404

    data = request.get_json(silent=True) or {}
    target_user_id = data.get("user_id")

    # Check target is a member of the organization
    target_org_mem = get_user_org_membership(target_user_id, org_id)
    if not target_org_mem:
        return jsonify({"error": "User must be an active organization member first."}), 400

    existing_team_mem = TeamMembership.query.filter_by(team_id=team_id, user_id=target_user_id).first()
    if existing_team_mem:
        return jsonify({"error": "User is already assigned to this team."}), 409

    team_mem = TeamMembership(
        team_id=team_id,
        user_id=target_user_id,
        assigned_at=utc_now(),
    )
    db.session.add(team_mem)
    db.session.commit()

    record_audit(org_id, user_id, "team_member_added", target_type="team", target_id=team_id, details={"user_id": target_user_id})

    return jsonify({
        "status": "success",
        "message": "User assigned to team."
    }), 201


@organizations_bp.route("/<string:org_id>/teams/<string:team_id>/members/<string:target_user_id>", methods=["DELETE"])
@login_required
def remove_team_member(org_id, team_id, target_user_id):
    user_id = get_current_user_id()
    membership = get_user_org_membership(user_id, org_id)

    if not membership or membership.role not in {"owner", "admin", "office_manager"}:
        return jsonify({"error": "Permission denied."}), 403

    team_mem = TeamMembership.query.filter_by(team_id=team_id, user_id=target_user_id).first()
    if not team_mem:
        return jsonify({"error": "Member not in team."}), 404

    db.session.delete(team_mem)
    db.session.commit()

    record_audit(org_id, user_id, "team_member_removed", target_type="team", target_id=team_id, details={"user_id": target_user_id})

    return jsonify({
        "status": "success",
        "message": "Member removed from team."
    }), 200


# --------------------------------------------------
# 12. ORGANIZATION ANALYTICS & SPENDING
# --------------------------------------------------
@organizations_bp.route("/<string:org_id>/analytics", methods=["GET"])
@login_required
def get_organization_analytics(org_id):
    user_id = get_current_user_id()
    membership = get_user_org_membership(user_id, org_id)

    if not membership:
        return jsonify({"error": "Access denied."}), 403

    org = db.session.get(Organization, org_id)
    if not org:
        return jsonify({"error": "Organization not found."}), 404

    subscriptions = Subscription.query.filter_by(organization_id=org_id).all()
    active_subs = [s for s in subscriptions if s.status in {"active", "trial"}]

    total_monthly = sum(calculate_monthly_cost(s.amount, s.billing_interval) for s in active_subs)
    yearly_projected = total_monthly * Decimal("12")

    teams = Team.query.filter_by(organization_id=org_id, status="active").all()
    members_count = OrganizationMembership.query.filter_by(organization_id=org_id, status="active").count()

    return jsonify({
        "status": "success",
        "organization_id": org.id,
        "organization_name": org.name,
        "role": membership.role,
        "members_count": members_count,
        "teams_count": len(teams),
        "total_subscriptions": len(subscriptions),
        "active_subscriptions": len(active_subs),
        "monthly_recurring_spend": float(total_monthly),
        "yearly_projected_spend": float(yearly_projected),
    }), 200


# --------------------------------------------------
# 13. AUDIT LOGS (MANAGERS & ADMINS)
# --------------------------------------------------
@organizations_bp.route("/<string:org_id>/audit-logs", methods=["GET"])
@login_required
def get_audit_logs(org_id):
    user_id = get_current_user_id()
    membership = get_user_org_membership(user_id, org_id)

    if not membership or membership.role not in {"owner", "admin", "office_manager"}:
        return jsonify({"error": "Permission denied. Only organizational managers can view audit logs."}), 403

    limit = min(int(request.args.get("limit") or 50), 100)
    logs = (
        OrganizationAuditLog.query.filter_by(organization_id=org_id)
        .order_by(OrganizationAuditLog.created_at.desc())
        .limit(limit)
        .all()
    )

    return jsonify({
        "status": "success",
        "count": len(logs),
        "audit_logs": [l.to_dict() for l in logs]
    }), 200
