#!/usr/bin/env python3
"""Compile, watch, and serve the site without a JavaScript build tool."""

from __future__ import annotations

import argparse
import functools
import shutil
import subprocess
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"


def compile_once() -> None:
    subprocess.run(["tsc", "--project", "tsconfig.json"], cwd=ROOT, check=True)
    DIST.mkdir(exist_ok=True)
    shutil.copy2(ROOT / "index.html", DIST / "index.html")
    shutil.copy2(ROOT / "src" / "styles.css", DIST / "styles.css")


def main() -> None:
    parser = argparse.ArgumentParser(description="Compile, watch, and serve DS Explorer.")
    parser.add_argument("--port", type=int, default=8000, help="port to listen on (default: 8000)")
    args = parser.parse_args()

    compile_once()
    handler = functools.partial(SimpleHTTPRequestHandler, directory=str(DIST))
    server = ThreadingHTTPServer(("", args.port), handler)

    print(f"Serving {DIST} at http://localhost:{args.port}", flush=True)
    watcher = subprocess.Popen(
        ["tsc", "--watch", "--preserveWatchOutput", "--project", "tsconfig.json"],
        cwd=ROOT,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping development server.")
    finally:
        server.server_close()
        if watcher.poll() is None:
            watcher.terminate()
            try:
                watcher.wait(timeout=5)
            except subprocess.TimeoutExpired:
                watcher.kill()


if __name__ == "__main__":
    main()
