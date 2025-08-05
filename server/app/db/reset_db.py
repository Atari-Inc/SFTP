"""
Script to reset and recreate the database tables
Use this when you have schema conflicts
"""
from sqlalchemy import text
from ..database import SessionLocal, engine, Base
from ..models import User, File, ActivityLog
import logging

logger = logging.getLogger(__name__)

def reset_database():
    """Drop all tables and recreate them"""
    db = SessionLocal()
    try:
        logger.info("Dropping all tables...")
        
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
        logger.info("All tables dropped successfully")
        
        # Recreate all tables
        logger.info("Creating tables...")
        Base.metadata.create_all(bind=engine)
        logger.info("All tables created successfully")
        
    except Exception as e:
        logger.error(f"Error resetting database: {e}")
        db.rollback()
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    reset_database()