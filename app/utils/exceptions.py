from fastapi import HTTPException

class AnalysisError(HTTPException):
    def __init__(self, analysis_id: str, message: str):
        super().__init__(
            status_code=400,
            detail={
                "type": "analysis_error",
                "analysis_id": analysis_id,
                "message": message
            }
        )
