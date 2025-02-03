from celery import Celery
from redis import Redis
import time
import json
import os

celery = Celery(__name__, broker=os.getenv("CELERY_BROKER"))
redis = Redis.from_url(os.getenv("REDIS_URL"))

@celery.task
def process_analysis(analysis_id: str, url: str):
    try:
        # Simulate long-running task
        for i in range(1, 101):
            time.sleep(0.1)
            redis.setex(f"analysis:{analysis_id}:progress", 3600, i)
        
        # Store final result
        redis.setex(f"analysis:{analysis_id}:result", 3600, json.dumps({
            "insights": {"executiveSummary": "...", "strengths": [], "weaknesses": []},
            "opportunities": [],
            "recommendations": {"aiTools": [], "ghlFeatures": [], "advancedFeatures": []}
        }))
        redis.setex(f"analysis:{analysis_id}:status", 3600, "completed")
        
    except Exception as e:
        redis.setex(f"analysis:{analysis_id}:error", 3600, str(e))
        redis.setex(f"analysis:{analysis_id}:status", 3600, "error")
