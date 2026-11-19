
import os
from flask_migrate import Migrate
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, app, jsonify
from flask_cors import CORS
from sqlalchemy import URL, text

from app.database.extensions import db
from app.auth.routes import auth_bp
from app.subscriptions.routes import subscriptions_bp
from app.analytics.routes import analytics_bp
from app.intelligence.routes import intelligence_bp


def create_app():
    # Load environment variables from backend/.env
    backend_dir = Path(__file__).resolve().parent.parent
    load_dotenv(backend_dir / ".env")

    app = Flask(__name__)

    # Application configuration
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY")

    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    app.config["SESSION_COOKIE_SECURE"] = False
    app.config["PERMANENT_SESSION_LIFETIME"] = 86400
    
    app.config["SQLALCHEMY_DATABASE_URI"] = URL.create(
        drivername="mysql+pymysql",
        username=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "3306")),
        database=os.getenv("DB_NAME", "subloo_db"),
    )

    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # Initialize database
    db.init_app(app)

    # Register all database models
    from app.users import models as user_models
    from app.organizations import models as organization_models
    from app.gmail import models as gmail_models
    from app.intelligence import models as intelligence_models
    from app.subscriptions import models as subscription_models
    from app.teams import models as team_models

    # Initialize database migrations
    Migrate(app, db)

    # Register routes
    app.register_blueprint(auth_bp)
    app.register_blueprint(subscriptions_bp)
    app.register_blueprint(analytics_bp)
    app.register_blueprint(intelligence_bp)

    # Frontend connection
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": [
                    "http://localhost:5173",
                    "http://127.0.0.1:5173",
                    "http://localhost:5174",
                    "http://127.0.0.1:5174",
                    "http://localhost:3000",
                    "http://127.0.0.1:3000",
                ]
            }
        },
        supports_credentials=True
    )


    # Basic backend health check
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "success",
            "application": "Subloo",
            "message": "Backend server is running!"
        }), 200

    # Database connection test
    @app.route("/api/health/database", methods=["GET"])
    def database_health():
        try:
            db.session.execute(text("SELECT 1"))
            return jsonify({
                "status": "success",
                "database": "MySQL",
                "connected": True,
                "message": "Subloo database connection successful!"
            }), 200

        except Exception:
            app.logger.exception("Database connection failed")
            db.session.rollback()

            return jsonify({
                "status": "error",
                "connected": False,
                "message": "Database connection failed."
            }), 503

    return app
