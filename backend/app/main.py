from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
import uvicorn
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from api.endpoints import router as api_router

app = FastAPI(
    title="SEO Article Generation API",
    description="API for generating SEO-optimized articles with paraphrasing capabilities",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Next.js development server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api", tags=["articles"])

# Exception handler for validation errors
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"Validation error: {exc}")
    return JSONResponse(
        status_code=422,
        content={
            "detail": exc.errors(),
            "body": exc.body,
            "error": "Validation failed"
        }
    )

@app.exception_handler(ValidationError)
async def validation_error_handler(request: Request, exc: ValidationError):
    print(f"Pydantic validation error: {exc}")
    return JSONResponse(
        status_code=422,
        content={
            "detail": exc.errors(),
            "error": "Pydantic validation failed"
        }
    )

@app.get("/")
async def root():
    return {"message": "SEO Article Generation API is running"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "SEO Article Generation API"}

@app.get("/api/test")
async def test_endpoint():
    return {"message": "Backend is working correctly!"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)