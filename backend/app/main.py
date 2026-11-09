import os

import psycopg
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ["CORS_ORIGIN"]],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    with psycopg.connect(os.environ["DATABASE_URL"]) as conn:
        version = conn.execute("SELECT version()").fetchone()[0]
    return {"status": "ok", "db": version}
