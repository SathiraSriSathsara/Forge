import os
import uuid
import shutil
import subprocess
from pathlib import Path


def build_and_save_docker_image(
    dockerfile_path: str,
    image_name: str = None,
    uploads_dir: str = "../builds"
) -> str:
    """
    Build a Docker image and export it as a ZIP archive.

    Returns:
        Path to the generated ZIP file.
    """

    dockerfile_path = Path(dockerfile_path).resolve()
    dockerfile = dockerfile_path / "Dockerfile"

    if not dockerfile.exists():
        raise FileNotFoundError(f"Dockerfile not found: {dockerfile}")

    os.makedirs(uploads_dir, exist_ok=True)

    if image_name is None:
        image_name = f"image-{uuid.uuid4().hex[:8]}"

    tar_path = os.path.join(uploads_dir, f"{image_name}.tar")
    zip_path = os.path.join(uploads_dir, f"{image_name}.zip")

    try:
        print("Building Docker image...")

        subprocess.run(
            [
                "docker",
                "build",
                "-t",
                image_name,
                str(dockerfile_path)
            ],
            check=True
        )

        print("Saving Docker image...")

        subprocess.run(
            [
                "docker",
                "save",
                "-o",
                tar_path,
                image_name
            ],
            check=True
        )

        print("Compressing image...")

        shutil.make_archive(
            base_name=zip_path[:-4],  # Remove ".zip"
            format="zip",
            root_dir=uploads_dir,
            base_dir=os.path.basename(tar_path)
        )

        os.remove(tar_path)

        print(f"Image exported to: {zip_path}")

        return zip_path

    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Docker command failed: {e}")