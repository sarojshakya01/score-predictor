"""User business logic."""

import asyncio
import logging

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User, UserRole
from app.repositories.user_repository import UserRepository
from app.schemas.user import (
    UserCreate,
    UserListResponse,
    UserProfileUpdate,
    UserResponse,
    UserUpdate,
)

logger = logging.getLogger(__name__)

class UserService:
    """Handles user validation and orchestration."""

    def __init__(self, db: AsyncSession) -> None:
        self._user_repository = UserRepository(db)

    async def get_current_profile(self, user: User) -> UserResponse:
        """Return the current user's profile."""
        return UserResponse.model_validate(user)

    async def update_current_profile(
        self,
        *,
        user: User,
        data: UserProfileUpdate,
    ) -> UserResponse:
        """Update the current user's profile fields."""
        values = data.model_dump(exclude_unset=True)
        if not values:
            return UserResponse.model_validate(user)

        email = values.get("email")
        if isinstance(email, str) and await self._user_repository.email_exists(
            email,
            exclude_user_id=user.id,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        try:
            updated_user = await self._user_repository.update(user, values)
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        return UserResponse.model_validate(updated_user)

    async def list_users(
        self,
        *,
        offset: int,
        limit: int,
        role: UserRole | None = None,
        is_active: bool | None = None,
        search: str | None = None,
    ) -> UserListResponse:
        """Return paginated users for admin management."""
        try:
            users = await self._user_repository.list_users(
                offset=offset,
                limit=limit,
                role=role,
                is_active=is_active,
                search=search,
            )
            total = await self._user_repository.count_users(
                role=role,
                is_active=is_active,
                search=search,
            )
            return self._build_list_response(
                users=users,
                total=total,
                limit=limit,
                offset=offset,
            )
        except HTTPException:
            # Re-raise FastAPI HTTP exceptions
            raise
        except Exception as e:
            logger.exception("Unexpected error during list_users", e)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="An unexpected error occurred: could not list users",
            )

    async def create_user(self, data: UserCreate) -> UserResponse:
        """Create a user from the admin user management screen."""
        if await self._user_repository.email_exists(data.email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        user = User(
            email=data.email,
            first_name=data.first_name,
            middle_name=data.middle_name,
            last_name=data.last_name,
            mobile_no=data.mobile_no,
            password=hash_password(data.password),
            role=data.role,
            is_active=False, # do not activate by default
        )

        try:
            created_user = await self._user_repository.create(user)
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        return UserResponse.model_validate(created_user)

    async def update_user(
        self,
        *,
        user_id: int,
        current_admin_id: int,
        data: UserUpdate,
    ) -> UserResponse:
        """Update a user from the admin user management screen."""
        user = await self._get_user_or_404(user_id)
        is_user_active = user.is_active
        values = data.model_dump(exclude_unset=True)

        if not values:
            return UserResponse.model_validate(user)

        email = values.get("email")
        if isinstance(email, str) and await self._user_repository.email_exists(
            email,
            exclude_user_id=user_id,
        ):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        if user_id == current_admin_id:
            new_role = values.get("role")
            new_is_active = values.get("is_active")
            if new_role is not None and new_role != UserRole.ADMIN:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You cannot remove your own admin role",
                )
            if new_is_active is False:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You cannot deactivate your own account",
                )

        password = values.pop("password", None)
        if isinstance(password, str):
            values["password"] = hash_password(password)

        try:
            updated_user = await self._user_repository.update(user, values)
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email already registered",
            )

        # Fire activation/deactivation email when is_active changes.
        new_is_active = values.get("is_active")
        if isinstance(new_is_active, bool) and is_user_active != updated_user.is_active:
            try:
                from app.services.email_service import send_user_activation_email  # noqa: PLC0415
                asyncio.create_task(send_user_activation_email(
                    email=updated_user.email,
                    first_name=updated_user.first_name,
                    activated=new_is_active,
                ))
            except Exception:
                logger.exception(
                    "Failed to send activation email to user %s", updated_user.id
                )

        return UserResponse.model_validate(updated_user)

    async def delete_user(self, *, user_id: int, current_admin_id: int) -> None:
        """Delete a user from the admin user management screen."""
        if user_id == current_admin_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot delete your own account",
            )

        user = await self._get_user_or_404(user_id)
        try:
            await self._user_repository.delete(user)
        except IntegrityError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User cannot be deleted because it is in use",
            )

    async def _get_user_or_404(self, user_id: int) -> User:
        """Fetch a user or raise a 404."""
        user = await self._user_repository.get_by_id(user_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        return user

    @staticmethod
    def _build_list_response(
        *,
        users: list[User],
        total: int,
        limit: int,
        offset: int,
    ) -> UserListResponse:
        """Build a paginated user response."""
        return UserListResponse(
            items=[UserResponse.model_validate(user) for user in users],
            total=total,
            limit=limit,
            offset=offset,
        )
