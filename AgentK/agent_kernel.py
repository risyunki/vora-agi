from fastapi import FastAPI, WebSocket, Request
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import json
from typing import List, Dict, Any
from agents import hermes
import uuid

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage
tasks = []
active_connections: List[WebSocket] = []

@app.get("/")
async def root():
    return {"status": "ok"}

@app.get("/agents")
async def get_agents():
    return {
        "agents": [
            {
                "id": "bragi",
                "name": "Bragi",
                "status": "active",
                "type": "assistant",
                "description": "A wise and eloquent AI assistant that can help with various tasks"
            },
            {
                "id": "odin",
                "name": "Odin",
                "status": "active",
                "type": "coordinator",
                "description": "The wise overseer of all operations and strategic planning"
            },
            {
                "id": "thor",
                "name": "Thor",
                "status": "active",
                "type": "architect",
                "description": "The master builder and maintainer of the system's agents"
            }
        ]
    }

@app.get("/tasks")
async def get_tasks():
    return {"tasks": tasks}

@app.post("/tasks")
async def create_task(request: Request):
    task_data = await request.json()
    task_id = str(uuid.uuid4())
    task = {
        "id": task_id,
        "description": task_data.get("description", ""),
        "status": "in_progress",
        "result": None
    }
    tasks.append(task)
    
    # Notify connected clients about task creation
    for connection in active_connections:
        try:
            await connection.send_json({
                "type": "task_update",
                "data": task
            })
        except:
            pass
    
    # Process task with Hermes
    try:
        result = hermes.hermes(task_id, task["description"])
        task["result"] = result
        task["status"] = "completed"
    except Exception as e:
        task["result"] = str(e)
        task["status"] = "failed"
    
    # Notify connected clients about task completion
    for connection in active_connections:
        try:
            await connection.send_json({
                "type": "task_update",
                "data": task
            })
        except:
            pass
    
    return task

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except:
        pass
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)