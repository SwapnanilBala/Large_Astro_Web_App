"""Authentication endpoints: register and login."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field

from app.api.deps import get_current_user
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])

_auth_service = AuthService()


class RegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)
    display_name: str = Field(..., min_length=2, max_length=100)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)


class RedeemPlanRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=128)
    expected_plan: str | None = Field(default=None, pattern="^(basic|pro|ultimate)?$")


class AuthResponse(BaseModel):
    user_id: str
    email: str
    display_name: str
    subscription_tier: str
    token: str


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest) -> AuthResponse:
    try:
        result = _auth_service.register(body.email, body.password, body.display_name)
        return AuthResponse(**result)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(exc),
        ) from exc


@router.post("/login", response_model=AuthResponse)
def login(body: LoginRequest) -> AuthResponse:
    result = _auth_service.login(body.email, body.password)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    return AuthResponse(**result)


@router.post("/redeem-plan", response_model=AuthResponse)
def redeem_plan(
    body: RedeemPlanRequest,
    current_user: dict = Depends(get_current_user),
) -> AuthResponse:
    try:
        result = _auth_service.redeem_plan(
            current_user["sub"],
            body.code,
            body.expected_plan,
        )
        return AuthResponse(**result)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
