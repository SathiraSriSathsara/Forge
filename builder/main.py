from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from build import build_and_save_docker_image


app = FastAPI(
    title="Docker Image Builder API",
    version="1.0.0",
    description="Build Docker images and export them as ZIP files."
)


class DockerBuildRequest(BaseModel):
    dockerfile_path: str = Field(
        ...,
        examples=["../repos/repo-001"]
    )
    image_name: str = Field(
        ...,
        min_length=1,
        examples=["my-backend"]
    )


class DockerBuildResponse(BaseModel):
    success: bool
    message: str
    image_name: str
    zip_file: str


@app.get("/health")
def health_check():
    return {
        "success": True,
        "message": "Docker builder API is running"
    }


@app.post(
    "/build",
    response_model=DockerBuildResponse
)
def build_docker_image(request: DockerBuildRequest):
    try:
        dockerfile_path = Path(request.dockerfile_path).resolve()

        if not dockerfile_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Path not found: {dockerfile_path}"
            )

        if not dockerfile_path.is_dir():
            raise HTTPException(
                status_code=400,
                detail="dockerfile_path must be a directory"
            )

        dockerfile = dockerfile_path / "Dockerfile"

        if not dockerfile.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Dockerfile not found: {dockerfile}"
            )

        zip_file = build_and_save_docker_image(
            dockerfile_path=str(dockerfile_path),
            image_name=request.image_name,
            uploads_dir="../builds"
        )

        return DockerBuildResponse(
            success=True,
            message="Docker image built and exported successfully",
            image_name=request.image_name,
            zip_file=str(Path(zip_file).resolve())
        )

    except HTTPException:
        raise

    except FileNotFoundError as error:
        raise HTTPException(
            status_code=404,
            detail=str(error)
        )

    except RuntimeError as error:
        raise HTTPException(
            status_code=500,
            detail=str(error)
        )

    except Exception as error:
        raise HTTPException(
            status_code=500,
            detail=f"Unexpected error: {error}"
        )