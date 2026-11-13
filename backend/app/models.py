from datetime import datetime, timezone
from . import db

class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="user")
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    files = db.relationship("StoredFile", backref="owner", cascade="all, delete-orphan")

class StoredFile(db.Model):
    __tablename__ = "files"
    id = db.Column(db.String(36), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    original_name = db.Column(db.String(255), nullable=False)
    storage_key = db.Column(db.String(80), unique=True, nullable=False)
    mime_type = db.Column(db.String(100), nullable=False)
    extension = db.Column(db.String(10), nullable=False)
    size = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    shares = db.relationship("FileShare", backref="file", cascade="all, delete-orphan")

class FileShare(db.Model):
    __tablename__ = "file_shares"
    id = db.Column(db.String(36), primary_key=True)
    token = db.Column(db.String(128), unique=True, nullable=False, index=True)
    file_id = db.Column(db.String(36), db.ForeignKey("files.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    expires_at = db.Column(db.DateTime, nullable=False)
    revoked = db.Column(db.Boolean, nullable=False, default=False)
    used_count = db.Column(db.Integer, nullable=False, default=0)
