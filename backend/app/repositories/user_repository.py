"""Repository for user database operations."""

from collections.abc import Mapping

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole


class UserRepository:
    """Encapsulates all database operations for the User model."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_id(self, user_id: int) -> User | None:
        """Fetch a user by primary key."""
        result = await self._db.execute(
            select(User).where(User.id == user_id),
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        """Fetch a user by email address."""
        result = await self._db.execute(
            select(User).where(User.email == email),
        )
        return result.scalar_one_or_none()

    async def get_by_email_verification_token_hash(
        self,
        token_hash: str,
    ) -> User | None:
        """Fetch a user by email verification token hash."""
        result = await self._db.execute(
            select(User).where(User.email_verification_token_hash == token_hash),
        )
        return result.scalar_one_or_none()

    async def get_by_password_reset_token_hash(
        self,
        token_hash: str,
    ) -> User | None:
        """Fetch a user by password reset token hash."""
        result = await self._db.execute(
            select(User).where(User.password_reset_token_hash == token_hash),
        )
        return result.scalar_one_or_none()

    async def list_active_users(self) -> list[User]:
        """Fetch active users for public leaderboard rankings."""
        result = await self._db.execute(
            select(User)
            .where(User.is_active.is_(True))
            .order_by(User.created_at.asc(), User.id.asc()),
        )
        return list(result.scalars().all())

    async def list_active_normal_users(self) -> list[User]:
        """Fetch active users for public leaderboard rankings."""
        result = await self._db.execute(
            select(User)
            .where(User.is_active.is_(True))
            .where(User.role == UserRole.USER)
            .order_by(User.created_at.asc(), User.id.asc()),
        )
        return list(result.scalars().all())

    async def email_exists(
        self,
        email: str,
        *,
        exclude_user_id: int | None = None,
    ) -> bool:
        """Check whether an email is already registered."""
        statement = select(User.id).where(User.email == email)

        if exclude_user_id is not None:
            statement = statement.where(User.id != exclude_user_id)

        result = await self._db.execute(statement)
        return result.scalar_one_or_none() is not None

    async def list_users(
        self,
        *,
        offset: int = 0,
        limit: int = 500,
        role: UserRole | None = None,
        is_active: bool | None = None,
        search: str | None = None,
    ) -> list[User]:
        """Fetch users with optional filters and pagination."""
        statement = select(User)

        if role is not None:
            statement = statement.where(User.role == role)

        if is_active is not None:
            statement = statement.where(User.is_active == is_active)

        if search is not None:
            search_pattern = f"%{search}%"
            statement = statement.where(
                or_(
                    User.email.ilike(search_pattern),
                    User.first_name.ilike(search_pattern),
                    User.last_name.ilike(search_pattern),
                    User.mobile_no.ilike(search_pattern),
                ),
            )

        result = await self._db.execute(
            statement.order_by(User.created_at.desc(), User.id.desc())
            .offset(offset)
            .limit(limit),
        )
        return list(result.scalars().all())

    async def count_users(
        self,
        *,
        role: UserRole | None = None,
        is_active: bool | None = None,
        search: str | None = None,
    ) -> int:
        """Count users using the same filters as list_users."""
        statement = select(func.count()).select_from(User)

        if role is not None:
            statement = statement.where(User.role == role)

        if is_active is not None:
            statement = statement.where(User.is_active == is_active)

        if search is not None:
            search_pattern = f"%{search}%"
            statement = statement.where(
                or_(
                    User.email.ilike(search_pattern),
                    User.first_name.ilike(search_pattern),
                    User.last_name.ilike(search_pattern),
                    User.mobile_no.ilike(search_pattern),
                ),
            )

        result = await self._db.execute(statement)
        return int(result.scalar_one())

    async def create(self, user: User) -> User:
        """Persist a new user and return the refreshed instance."""
        self._db.add(user)
        await self._db.commit()
        await self._db.refresh(user)
        return user

    async def update(self, user: User, values: Mapping[str, object]) -> User:
        """Update an existing user and return the refreshed instance."""
        for field_name, value in values.items():
            setattr(user, field_name, value)

        await self._db.commit()
        await self._db.refresh(user)
        return user

    async def delete(self, user: User) -> None:
        """Delete an existing user."""
        await self._db.delete(user)
        await self._db.commit()
