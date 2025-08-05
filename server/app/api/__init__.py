from fastapi import APIRouter
from .auth import router as auth_router
from .users import router as users_router
from .files import router as files_router
from .sftp import router as sftp_router
from .activity import router as activity_router
from .stats import router as stats_router
from .folders import router as folders_router

api_router = APIRouter(prefix="/api")

api_router.include_router(auth_router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users_router, prefix="/users", tags=["Users"])
api_router.include_router(files_router, prefix="/files", tags=["Files"])
api_router.include_router(sftp_router, prefix="/sftp", tags=["SFTP"])
api_router.include_router(activity_router, prefix="/activity", tags=["Activity"])
api_router.include_router(stats_router, prefix="/stats", tags=["Statistics"])
api_router.include_router(folders_router, prefix="/folders", tags=["Folders"])