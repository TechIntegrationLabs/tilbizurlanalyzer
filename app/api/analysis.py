from fastapi import APIRouter, HTTPException, status
from fastapi.responses import EventSourceResponse
from redis import Redis
import json
import os
import asyncio
import uuid
from app.tasks.analysis import process_analysis
from app.utils.exceptions import AnalysisError

router = APIRouter()
redis = Redis.from_url(os.getenv("REDIS_URL"))

@router.post("/start-analysis", status_code=status.HTTP_202_ACCEPTED)
async def start_analysis(url: str):
    analysis_id = str(uuid.uuid4())
    try:
        process_analysis.delay(analysis_id, url)
        return {"analysis_id": analysis_id}
    except Exception as e:
        raise AnalysisError(analysis_id=analysis_id, message=str(e))

@router.get("/analysis/{analysis_id}")
async def stream_analysis(analysis_id: str):
    async def event_generator():
        while True:
            progress = redis.get(f"analysis:{analysis_id}:progress") or 0
            status = redis.get(f"analysis:{analysis_id}:status") or "processing"
            
            if status == "error":
                yield json.dumps({
                    "event": "error",
                    "data": redis.get(f"analysis:{analysis_id}:error")
                })
                break
                
            if status == "completed":
                yield json.dumps({
                    "event": "completed",
                    "data": redis.get(f"analysis:{analysis_id}:result")
                })
                break

            yield json.dumps({
                "event": "progress",
                "data": {"progress": int(progress), "status": status.decode()}
            })
            await asyncio.sleep(1)

    return EventSourceResponse(event_generator())
