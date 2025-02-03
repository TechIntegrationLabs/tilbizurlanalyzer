#!/bin/bash
set -a
source .env
set +a

uvicorn app.main:app --reload &
celery -A app.tasks.analysis worker --loglevel=info
