from fastapi import APIRouter

router = APIRouter(tags=["ingest"])


@router.post("/ingest/blackboard")
def ingest_blackboard_stub() -> dict:
    return {"status": "not_implemented", "message": "Blackboard ingest is not enabled in this build."}
