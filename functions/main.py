import os
import sys
from pathlib import Path

from a2wsgi import ASGIMiddleware
from firebase_functions import https_fn
from werkzeug.wrappers import Response

# Make backend package importable inside Cloud Functions runtime.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = PROJECT_ROOT / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Use writable temp storage in serverless environments when MongoDB is unavailable.
os.environ.setdefault("DATA_STORAGE_DIR", "/tmp/agentguard-data")

from main import app as fastapi_app  # noqa: E402

_wsgi_app = ASGIMiddleware(fastapi_app)


@https_fn.on_request()
def api(req: https_fn.Request) -> https_fn.Response:
    return Response.from_app(_wsgi_app, req.environ)
