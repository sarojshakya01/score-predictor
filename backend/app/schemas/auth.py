"""Pydantic schemas for authentication requests and responses."""

from pydantic import BaseModel, EmailStr, Field, field_validator


class SignupRequest(BaseModel):
    """Schema for user registration."""

    email: EmailStr
    first_name: str = Field(..., min_length=1, max_length=100)
    middle_name: str | None = Field(default=None, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    mobile_no: str = Field(..., min_length=1, max_length=20)
    password: str = Field(..., min_length=8, max_length=128)

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


class LoginRequest(BaseModel):
    """Schema for user login."""

    email: EmailStr
    password: str = Field(..., min_length=1)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        """Normalize email for consistent lookup."""
        return str(value).strip().lower()


class RefreshTokenRequest(BaseModel):
    """Schema for token refresh."""

    refresh_token: str = Field(..., min_length=1)


class EmailRequest(BaseModel):
    """Schema for account email actions."""

    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        """Normalize email for consistent lookup."""
        return str(value).strip().lower()


class TokenRequest(BaseModel):
    """Schema for one-time token actions."""

    token: str = Field(..., min_length=1)


class ResetPasswordRequest(TokenRequest):
    """Schema for setting a new password with a reset token."""

    password: str = Field(..., min_length=8, max_length=128)


class ChangePasswordRequest(BaseModel):
    """Schema for changing the current user's password."""

    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


class MessageResponse(BaseModel):
    """Schema for non-token auth responses."""

    message: str


class TokenResponse(BaseModel):
    """Schema for JWT token pair response."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    message: str = ""
