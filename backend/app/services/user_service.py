"""User business logic."""

import asyncio
import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import User, UserRole
from app.repositories.team_repository import TeamRepository
from app.repositories.user_repository import UserRepository
from app.repositories.setting_repository import SettingRepository

from app.schemas.user import (
    UserCreate,
    UserListResponse,
    UserProfileUpdate,
    UserResponse,
    UserUpdate,
)

logger = logging.getLogger(__name__)

FINALIST_TEAM_ID_FIELDS = (
    "winner_team_id",
    "runner_up_team_id",
    "third_place_team_id",
)


def _now() -> datetime:
    """Return the current UTC time."""
    return datetime.now(timezone.utc)


class UserService:
    """Handles user validation and orchestration."""

    def __init__(self, db: AsyncSession) -> None:
        self._user_repository = UserRepository(db)
        self._team_repository = TeamRepository(db)
        self._setting_repository = SettingRepository(db)

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

        await self._validate_team_ids(values)
        await self._validate_winners_prediction_deadline(values)

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

    async def get_user(self, user_id: int) -> UserResponse:
        """Return a single user by id."""
        user = await self._get_user_or_404(user_id)
        return UserResponse.model_validate(user)

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
            is_active=data.is_active,
            email_verified_at=_now() if data.is_active else None,
            winner_team_id=data.winner_team_id,
            runner_up_team_id=data.runner_up_team_id,
            third_place_team_id=data.third_place_team_id,
        )

        await self._validate_team_ids(
            {
                field_name: getattr(data, field_name)
                for field_name in FINALIST_TEAM_ID_FIELDS
            },
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

        if values.get("is_active") is True and user.email_verified_at is None:
            values["email_verified_at"] = _now()

        await self._validate_team_ids(values)

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

    async def _validate_team_ids(self, values: dict[str, object]) -> None:
        """Ensure provided finalist team IDs reference existing teams."""
        for field_name in FINALIST_TEAM_ID_FIELDS:
            team_id = values.get(field_name)
            if team_id is None:
                continue

            team = await self._team_repository.get_by_id(int(team_id))
            if team is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{field_name} must reference an existing team",
                )

    async def _validate_winners_prediction_deadline(self, values: dict[str, object]) -> None:
        """Ensure provided finalist team IDs are not set after deadline."""
        for field_name in FINALIST_TEAM_ID_FIELDS:
            if values.get(field_name) is not None:
                current_match_day = await self._setting_repository.get_by_name("current_match_day")

                if current_match_day is None or current_match_day.value is None or current_match_day.value == {}:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail="Current match day not set",
                    )

                if int(current_match_day.value['day']) > 8:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Winners can not be selected after 8th day of tournament",
                    )

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
