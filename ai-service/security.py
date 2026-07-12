from __future__ import annotations

import hmac
import os

from fastapi import Header, HTTPException


SERVICE_TOKEN_HEADER = "X-Service-Token"


def require_admin_token(
    x_service_token: str | None = Header(default=None, alias=SERVICE_TOKEN_HEADER),
) -> None:
    expected = os.getenv("AI_SERVICE_ADMIN_TOKEN", "")
    if not x_service_token:
        raise HTTPException(status_code=401, detail="service token required")
    if not expected or not hmac.compare_digest(x_service_token.encode(), expected.encode()):
        raise HTTPException(status_code=403, detail="invalid service token")
