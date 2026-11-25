"""Fetch versioned research assets without committing large or personal files."""
import argparse
import hashlib
import urllib.request
from pathlib import Path
from urllib.parse import quote

MODEL = "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task"
RECORD = "https://zenodo.org/records/18399031/files/"
DATA = {
    "metadata": ("01_participant_metadata.zip", "394dda1748369c139bd9d2d5b86b8268"),
    "optical": ("02_marker_based_data.zip", "b86d930761d3cd85105376559f6e1880"),
    "video": ("03_markerless_data.zip", "cb3a5d235bf847196466adac8281e754"),
    "code": ("04_ code_and_model_data.zip", "99d4e165a3805fcc71e3e745fc95b741"),
}

def fetch(url, target, md5=None):
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_suffix(target.suffix + ".part")
    digest = hashlib.md5()
    sha = hashlib.sha256()
    try:
        with urllib.request.urlopen(url, timeout=90) as response, temp.open("wb") as f:
            while True:
                block = response.read(1024 * 1024)
                if not block:
                    break
                f.write(block)
                digest.update(block)
                sha.update(block)
        if md5 and digest.hexdigest() != md5:
            raise ValueError("Zenodo MD5 does not match the pinned record")
        if not temp.stat().st_size:
            raise ValueError("Empty download")
        temp.replace(target)
        print(f"{target}: SHA256={sha.hexdigest()}")
    finally:
        if temp.exists():
            temp.unlink()

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("asset", choices=["model", *DATA])
    p.add_argument("--out", type=Path, default=Path("local-data"))
    p.add_argument("--accept-data-terms", action="store_true",
                   help="confirm that you have reviewed the dataset terms and participant privacy restrictions")
    args = p.parse_args()
    if args.asset == "model":
        fetch(MODEL, args.out / "pose_landmarker_lite.task")
    else:
        if not args.accept_data_terms:
            p.error("Review https://zenodo.org/records/18399031 and confirm --accept-data-terms")
        name, digest = DATA[args.asset]
        fetch(RECORD + quote(name) + "?download=1", args.out / name, digest)

if __name__ == "__main__":
    main()
