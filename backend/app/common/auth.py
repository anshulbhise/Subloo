import re
from functools import wraps
from flask import jsonify, request, session

from app.database.extensions import db
from app.users.models import User


def trusted_origin():
    """
    Allow requests from local frontend development servers or without an Origin header.
    """
    origin = request.headers.get("Origin")

    if origin is None:
        return True

    # Allow localhost or 127.0.0.1 on standard Vite/frontend development ports
    allowed_patterns = [
        r"^http://localhost(:\d+)?$",
        r"^http://127\.0\.0\.1(:\d+)?$",
    ]

    return any(re.match(pattern, origin) for pattern in allowed_patterns)


def login_required(view_func):
    """
    Decorator to ensure user is authenticated via session.
    Guarantees session['user_id'] is present and user exists in database.
    """
    @wraps(view_func)
    def wrapped_view(*args, **kwargs):
        user_id = session.get("user_id")

        if not user_id:
            return jsonify({
                "error": "Authentication required.",
                "authenticated": False
            }), 401

        user = db.session.get(User, user_id)

        if not user or not user.is_active:
            session.clear()
            return jsonify({
                "error": "Session is invalid or account is inactive.",
                "authenticated": False
            }), 401

        return view_func(*args, **kwargs)

    return wrapped_view


def get_current_user_id():
    """Return the currently authenticated user's ID from session."""
    return session.get("user_id")
