"""Pydantic schemas for user requests and responses."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models.user import UserRole


class UserProfileUpdate(BaseModel):
    """Schema for updating the current user's profile."""

    email: EmailStr | None = None
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    middle_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    mobile_no: str | None = Field(default=None, min_length=1, max_length=20)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr | None) -> str | None:
        """Normalize email for consistent lookup."""
        if value is None:
            return None
        return str(value).strip().lower()

    @field_validator("first_name", "last_name", "mobile_no")
    @classmethod
    def strip_required_text(cls, value: str | None) -> str | None:
        """Normalize required text fields when provided."""
        if value is None:
            return None

        stripped_value = value.strip()
        if not stripped_value:
            raise ValueError("value must not be empty")
        return stripped_value

    @field_validator("middle_name")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        """Normalize optional text fields."""
        if value is None:
            return None

        stripped_value = value.strip()
        return stripped_value or None


class UserCreate(BaseModel):
    """Schema for admin-created users."""

    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    middle_name: str | None = Field(default=None, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    mobile_no: str = Field(..., min_length=1, max_length=20)
    password: str = Field(..., min_length=8, max_length=128)
    role: UserRole = UserRole.USER
    is_active: bool = True

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        """Normalize email for consistent lookup."""
        return str(value).strip().lower()

    @field_validator("first_name", "last_name", "mobile_no")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        """Normalize required text fields."""
        stripped_value = value.strip()
        if not stripped_value:
            raise ValueError("value must not be empty")
        return stripped_value

    @field_validator("middle_name")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        """Normalize optional text fields."""
        if value is None:
            return None

        stripped_value = value.strip()
        return stripped_value or None


class UserUpdate(BaseModel):
    """Schema for admin user updates."""

    email: EmailStr | None = None
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    middle_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    mobile_no: str | None = Field(default=None, min_length=1, max_length=20)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    role: UserRole | None = None
    is_active: bool | None = None

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr | None) -> str | None:
        """Normalize email for consistent lookup."""
        if value is None:
            return None
        return str(value).strip().lower()

    @field_validator("first_name", "last_name", "mobile_no")
    @classmethod
    def strip_required_text(cls, value: str | None) -> str | None:
        """Normalize required text fields when provided."""
        if value is None:
            return None

        stripped_value = value.strip()
        if not stripped_value:
            raise ValueError("value must not be empty")
        return stripped_value

    @field_validator("middle_name")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        """Normalize optional text fields."""
        if value is None:
            return None

        stripped_value = value.strip()
        return stripped_value or None


class UserResponse(BaseModel):
    """Public user representation returned by API endpoints."""

    id: int
    email: EmailStr
    first_name: str
    middle_name: str | None
    last_name: str
    mobile_no: str
    role: UserRole
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserListResponse(BaseModel):
    """Paginated user list response."""

    items: list[UserResponse]
    total: int
    limit: int
    offset: int
