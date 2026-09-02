"""Production bridge to the persistent LH2 CFD worker.

The API only submits and retrieves execution evidence. Scientific gate decisions
remain server-authoritative and this bridge never returns VALIDATED by itself.
"""
from __future__ import annotations
import os
from typing import Any, Dict
import httpx
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

router = APIRouter(prefix="/v1/cfd-worker", tags=["cfd-worker"])

class JobRequest(BaseModel):
    pilotId: str = Field(default="PILOT-LH2-001")
    case: str = Field(pattern="^(CFD-BASELINE|CFD-INDEPENDENT)$")


def _worker_url() -> str:
    url = os.getenv("LH2_CFD_WORKER_URL", "").strip().rstrip("/")
    if not url:
        raise HTTPException(status_code=503, detail="LH2_CFD_WORKER_URL is not configured")
    return url


def _check_token(token: str | None) -> None:
    expected = os.getenv("LH2_CFD_WORKER_TOKEN", "").strip()
    if not expected or token != expected:
        raise HTTPException(status_code=401, detail="Invalid CFD worker authorization")


@router.get("/health")
async def worker_health(x_worker_token: str | None = Header(default=None)) -> Dict[str, Any]:
    _check_token(x_worker_token)
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(f"{_worker_url()}/health")
        response.raise_for_status()
        return {"worker": response.json(), "scientificStatus": "INCONCLUSIVE"}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"CFD worker unavailable: {exc}") from exc


@router.post("/jobs", status_code=202)
async def submit_job(payload: JobRequest, x_worker_token: str | None = Header(default=None)) -> Dict[str, Any]:
    _check_token(x_worker_token)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(f"{_worker_url()}/jobs", json=payload.model_dump())
        if response.status_code >= 400:
            raise HTTPException(status_code=502, detail={"worker": response.text, "scientificStatus": "INCONCLUSIVE"})
        result = response.json()
        result["scientificStatus"] = "INCONCLUSIVE"
        result["validationAllowed"] = False
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"CFD worker submission failed: {exc}") from exc
