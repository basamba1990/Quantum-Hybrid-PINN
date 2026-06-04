from fastapi import Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import logging
import traceback
from datetime import datetime

logger = logging.getLogger(__name__)

class QuantumPINNError(Exception):
    """Base class for exceptions in this module."""
    def __init__(self, message: str, status_code: int = 500, detail: dict = None):
        self.message = message
        self.status_code = status_code
        self.detail = detail or {}
        super().__init__(self.message)

class PhysicsValidationError(QuantumPINNError):
    """Exception raised for errors in physics validation."""
    def __init__(self, message: str, detail: dict = None):
        super().__init__(message, status_code=422, detail=detail)

class ModelInferenceError(QuantumPINNError):
    """Exception raised for errors during model inference."""
    def __init__(self, message: str, detail: dict = None):
        super().__init__(message, status_code=503, detail=detail)

async def quantum_error_handler(request: Request, exc: QuantumPINNError):
    logger.error(f"QuantumPINNError: {exc.message} - Detail: {exc.detail}")
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.__class__.__name__,
            "message": exc.message,
            "detail": exc.detail,
            "timestamp": datetime.utcnow().isoformat(),
            "path": request.url.path
        }
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation Error: {exc.errors()}")
    return JSONResponse(
        status_code=400,
        content={
            "error": "ValidationError",
            "message": "Données d'entrée invalides",
            "detail": exc.errors(),
            "timestamp": datetime.utcnow().isoformat()
        }
    )

async def generic_exception_handler(request: Request, exc: Exception):
    error_id = datetime.now().strftime('%Y%m%d%H%M%S')
    logger.critical(f"Unhandled Exception [{error_id}]: {str(exc)}")
    logger.critical(traceback.format_exc())
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "InternalServerError",
            "message": "Une erreur inattendue est survenue",
            "error_id": error_id,
            "timestamp": datetime.utcnow().isoformat()
        }
    )

def setup_error_handlers(app):
    app.add_exception_handler(QuantumPINNError, quantum_error_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)
