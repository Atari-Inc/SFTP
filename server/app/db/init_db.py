from sqlalchemy.orm import Session
from ..database import SessionLocal, engine, Base
from ..models.user import User, UserRole
from ..core.security import get_password_hash
import logging

logger = logging.getLogger(__name__)

def reset_and_init_db() -> None:
    """Reset database and initialize with default data"""
    from sqlalchemy import text
    
    # Drop and recreate tables to avoid conflicts
    db = SessionLocal()
    try:
        logger.info("Resetting database tables...")
        
        # Drop tables in reverse dependency order
        db.execute(text("DROP TABLE IF EXISTS activity_logs CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS files CASCADE"))
        db.execute(text("DROP TABLE IF EXISTS users CASCADE"))
        
        # Drop custom types if they exist
        db.execute(text("DROP TYPE IF EXISTS userrole CASCADE"))
        db.execute(text("DROP TYPE IF EXISTS filetype CASCADE"))
        db.execute(text("DROP TYPE IF EXISTS activityaction CASCADE"))
        db.execute(text("DROP TYPE IF EXISTS activitystatus CASCADE"))
        
        db.commit()
        logger.info("Old tables dropped successfully")
        
    except Exception as e:
        logger.warning(f"Error dropping tables (this is normal for first run): {e}")
        db.rollback()
    finally:
        db.close()
    
    # Create all tables
    logger.info("Creating new tables...")
    Base.metadata.create_all(bind=engine)

def init_db() -> None:
    """Initialize database with default data"""
    # Reset and create tables first
    reset_and_init_db()
    
    # Create initial admin user
    db = SessionLocal()
    try:
        # Check if admin user exists
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            admin_user = User(
                username="admin",
                email="admin@example.com",
                password_hash=get_password_hash("admin123"),
                role=UserRole.ADMIN,
                is_active=True
            )
            db.add(admin_user)
            logger.info("Created default admin user: admin/admin123")
        
        # Check if regular user exists
        regular_user = db.query(User).filter(User.username == "user").first()
        if not regular_user:
            regular_user = User(
                username="user",
                email="user@example.com",
                password_hash=get_password_hash("user123"),
                role=UserRole.USER,
                is_active=True
            )
            db.add(regular_user)
            logger.info("Created default user: user/user123")
        
        db.commit()
        logger.info("Database initialization completed")
        
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    init_db()