import os
import json
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv, set_key

ENV_FILE = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
if os.path.exists(ENV_FILE):
    load_dotenv(ENV_FILE)

from backend.agent import AIAssistantAgent
from backend.tools import tool_manage_notes, tool_list_files, WORKSPACE_DIR, DATA_DIR

app = FastAPI(title="Jarvis Personal AI Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

agent = AIAssistantAgent(
    api_key=os.getenv("AI_API_KEY") or os.getenv("OPENAI_API_KEY", ""),
    model=os.getenv("AI_MODEL", "openai/gpt-oss-120b"),
    provider=os.getenv("AI_PROVIDER", "groq")
)

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    api_key: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None

class SettingsUpdate(BaseModel):
    api_key: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    system_prompt: Optional[str] = None

class NoteCreate(BaseModel):
    title: str
    content: str

@app.get("/api/settings")
def get_settings():
    env_key = os.getenv("AI_API_KEY") or os.getenv("OPENAI_API_KEY", "") or agent.api_key
    masked_key = ""
    if env_key:
        masked_key = env_key[:6] + "..." + env_key[-4:] if len(env_key) > 10 else "***"
    return {
        "has_api_key": bool(env_key),
        "masked_key": masked_key,
        "provider": agent.provider or "groq",
        "model": agent.model or "openai/gpt-oss-120b",
        "system_prompt": agent.system_prompt
    }

@app.post("/api/settings")
def update_settings(data: SettingsUpdate):
    if data.api_key:
        agent.api_key = data.api_key
        try:
            if not os.path.exists(ENV_FILE):
                with open(ENV_FILE, "w") as f:
                    f.write("")
            set_key(ENV_FILE, "AI_API_KEY", data.api_key)
        except Exception:
            pass
        os.environ["AI_API_KEY"] = data.api_key

    if data.provider:
        agent.provider = data.provider
        try:
            set_key(ENV_FILE, "AI_PROVIDER", data.provider)
        except Exception:
            pass
        os.environ["AI_PROVIDER"] = data.provider

    if data.model:
        agent.model = data.model
        try:
            set_key(ENV_FILE, "AI_MODEL", data.model)
        except Exception:
            pass
        os.environ["AI_MODEL"] = data.model

    if data.system_prompt:
        agent.system_prompt = data.system_prompt

    return {"status": "success", "message": "Settings updated successfully."}

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    async def sse_generator():
        messages = [m.model_dump() for m in req.messages]
        async for event in agent.chat_stream(
            messages=messages,
            api_key=req.api_key,
            model=req.model,
            provider=req.provider
        ):
            yield f"event: {event['event']}\ndata: {json.dumps(event['data'])}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

@app.get("/api/notes")
def list_notes():
    return tool_manage_notes(action="list")

@app.post("/api/notes")
def create_note(note: NoteCreate):
    return tool_manage_notes(action="add", title=note.title, content=note.content)

@app.delete("/api/notes/{note_id}")
def delete_note(note_id: str):
    return tool_manage_notes(action="delete", title=note_id)

@app.get("/api/workspace")
def list_workspace():
    return tool_list_files(".")

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        dest_path = os.path.join(WORKSPACE_DIR, file.filename)
        with open(dest_path, "wb") as f:
            content = await file.read()
            f.write(content)
        return {
            "status": "success",
            "filename": file.filename,
            "filepath": dest_path,
            "size": len(content)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Static files are served by Vercel from the public/ directory
# No StaticFiles mount needed in serverless deployment
