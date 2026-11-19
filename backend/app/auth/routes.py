
import uuid
from flask import Blueprint, jsonify, request, session
from sqlalchemy.exc import IntegrityError
from werkzeug.security import (
    generate_password_hash,
    check_password_hash
)

from app.database.extensions import db
from app.users.models import User, UserProfile
from app.common.auth import trusted_origin


auth_bp = Blueprint(
    "auth",
    __name__,
    url_prefix="/api/auth"
)


def user_response(user):
    """Return safe user information without password data."""

    return {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "email_verified": user.email_verified,
        "is_active": user.is_active
    }


# --------------------------------------------------
# REGISTER
# --------------------------------------------------

@auth_bp.route("/register", methods=["POST"])
def register():

    if not trusted_origin():
        return jsonify({
            "error": "Untrusted request origin."
        }), 403

    data = request.get_json(silent=True) or {}

    full_name = str(data.get("full_name") or "").strip()
    email = str(data.get("email") or "").strip().lower()
    password = data.get("password")

    if not full_name or not email or not isinstance(password, str):
        return jsonify({
            "error": "Name, email and password are required."
        }), 400

    if len(full_name) > 120:
        return jsonify({
            "error": "Name must be 120 characters or fewer."
        }), 400

    if len(email) > 255 or "@" not in email:
        return jsonify({
            "error": "Please enter a valid email address."
        }), 400

    if len(password) < 12:
        return jsonify({
            "error": "Password must contain at least 12 characters."
        }), 400

    try:
        if User.query.filter_by(email=email).first():
            return jsonify({
                "error": "An account with this email already exists."
            }), 409

        user_id = str(uuid.uuid4())
        user = User(
            id=user_id,
            full_name=full_name,
            email=email,
            password_hash=generate_password_hash(password)
        )

        user.profile = UserProfile(
            id=str(uuid.uuid4()),
            user_id=user_id,
            currency="INR",
            timezone="Asia/Kolkata"
        )

        db.session.add(user)
        db.session.commit()

        user_data = user_response(user)

    except IntegrityError:
        db.session.rollback()

        return jsonify({
            "error": "Unable to create account with these details."
        }), 409
    except Exception as e:
        db.session.rollback()

        return jsonify({
            "error": f"Database error: {str(e)}"
        }), 500

    session.clear()
    session["user_id"] = user_id
    session.permanent = True

    return jsonify({
        "status": "success",
        "message": "Account created successfully.",
        "user": user_data
    }), 201


# --------------------------------------------------
# LOGIN
# --------------------------------------------------

@auth_bp.route("/login", methods=["POST"])
def login():

    if not trusted_origin():
        return jsonify({
            "error": "Untrusted request origin."
        }), 403

    data = request.get_json(silent=True) or {}

    email = str(data.get("email") or "").strip().lower()
    password = data.get("password")

    if not email or not isinstance(password, str):
        return jsonify({
            "error": "Email and password are required."
        }), 400

    try:
        user = User.query.filter_by(email=email).first()
    except Exception as e:
        return jsonify({
            "error": f"Database error: {str(e)}"
        }), 500

    if (
        not user
        or not user.password_hash
        or not check_password_hash(user.password_hash, password)
    ):
        return jsonify({
            "error": "Invalid email or password."
        }), 401

    if not user.is_active:
        return jsonify({
            "error": "This account is currently inactive."
        }), 403

    session.clear()
    session["user_id"] = user.id
    session.permanent = True

    return jsonify({
        "status": "success",
        "message": "Login successful.",
        "user": user_response(user)
    }), 200


# --------------------------------------------------
# CURRENT USER
# --------------------------------------------------

@auth_bp.route("/me", methods=["GET"])
def current_user():

    user_id = session.get("user_id")

    if not user_id:
        return jsonify({
            "authenticated": False,
            "message": "Please log in."
        }), 401

    user = db.session.get(User, user_id)

    if not user or not user.is_active:
        session.clear()

        return jsonify({
            "authenticated": False,
            "message": "Session is invalid."
        }), 401

    return jsonify({
        "authenticated": True,
        "user": user_response(user)
    }), 200


# --------------------------------------------------
# LOGOUT
# --------------------------------------------------

@auth_bp.route("/logout", methods=["POST"])
def logout():

    if not trusted_origin():
        return jsonify({
            "error": "Untrusted request origin."
        }), 403

    session.clear()

    return jsonify({
        "status": "success",
        "message": "Logged out successfully."
    }), 200
