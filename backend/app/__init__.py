import os
import logging
import time
from flask import Flask, g, jsonify, request
from flask_sqlalchemy import SQLAlchemy
from flask_swagger_ui import get_swaggerui_blueprint
from werkzeug.security import generate_password_hash

db = SQLAlchemy()

def create_app():
    app = Flask(__name__)
    app.logger.setLevel(logging.INFO)
    app.config.update(
        SECRET_KEY=os.getenv("SECRET_KEY", "unsafe-development-key"),
        SQLALCHEMY_DATABASE_URI="sqlite:////app/data/pixel_storage.db",
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        MAX_CONTENT_LENGTH=int(os.getenv("MAX_CONTENT_LENGTH", 10 * 1024 * 1024)),
        STORAGE_PATH="/app/storage",
        FILE_CACHE_TTL_SECONDS=int(os.getenv("FILE_CACHE_TTL_SECONDS", 60)),
        SHARE_LINK_TTL_MINUTES=int(os.getenv("SHARE_LINK_TTL_MINUTES", 60)),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=False,  # Local HTTP no Docker; habilitar HTTPS em produção.
    )
    os.makedirs(app.config["STORAGE_PATH"], exist_ok=True)
    os.makedirs("/app/data", exist_ok=True)
    db.init_app(app)

    from . import models
    from .openapi import API_SPEC
    from .routes import api
    app.register_blueprint(api, url_prefix="/api")

    @app.get("/api/openapi.json")
    def openapi_spec():
        return jsonify(API_SPEC)

    swagger_ui = get_swaggerui_blueprint(
        "/api/docs",
        "/api/openapi.json",
        config={"app_name": "Pixel Breeders projeto Camada API"},
    )
    app.register_blueprint(swagger_ui)

    @app.before_request
    def log_request_start():
        g.request_started_at = time.perf_counter()

    @app.after_request
    def log_request_completion(response):
        started_at = getattr(g, "request_started_at", None)
        duration_ms = round((time.perf_counter() - started_at) * 1000, 1) if started_at is not None else None
        app.logger.info(
            "http_request method=%s endpoint=%s status=%s duration_ms=%s",
            request.method,
            request.endpoint or "unmatched",
            response.status_code,
            duration_ms,
        )
        return response

    @app.errorhandler(413)
    def too_large(_error):
        return jsonify(error="O arquivo excede o limite de 10 MB."), 413

    with app.app_context():
        db.create_all()
        bootstrap_admin()

    return app

def bootstrap_admin():
    """Cria o admin apenas se ainda não existir; nunca redefine senha ou role."""
    from .models import User
    email = os.getenv("ADMIN_EMAIL", "admin@local.test").strip().lower()
    password = os.getenv("ADMIN_PASSWORD", "admin")
    existing = User.query.filter_by(email=email).first()
    if existing:
        return
    db.session.add(User(
        email=email,
        password_hash=generate_password_hash(password),
        role="admin",
    ))
    db.session.commit()
