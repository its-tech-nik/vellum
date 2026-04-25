#!/usr/bin/env python3
"""Build browser-specific extension bundles into dist/."""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST_ROOT = ROOT / "dist"

MANIFESTS = {
    "chrome": ROOT / "manifest.json",
    "firefox": ROOT / "manifest.firefox.json",
}

COPY_PATHS = [
    "assets",
    "background.js",
    "content.js",
    "popup.css",
    "popup.html",
    "popup.js",
]


def copy_path(source: Path, destination: Path) -> None:
    if source.is_dir():
        shutil.copytree(source, destination, dirs_exist_ok=True)
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)


def build_target(target: str) -> None:
    manifest_source = MANIFESTS[target]
    output_dir = DIST_ROOT / target
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    for relative in COPY_PATHS:
        source = ROOT / relative
        destination = output_dir / relative
        copy_path(source, destination)

    shutil.copy2(manifest_source, output_dir / "manifest.json")
    print(f"Built {target}: {output_dir}")


def main(argv: list[str]) -> int:
    targets = list(MANIFESTS.keys())
    if len(argv) > 1:
        requested = argv[1]
        if requested not in MANIFESTS:
            valid = ", ".join(targets)
            print(f"Unknown target '{requested}'. Valid targets: {valid}")
            return 1
        targets = [requested]

    for target in targets:
        build_target(target)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
