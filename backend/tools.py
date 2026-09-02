import os
import sys
import json
import subprocess
import requests
import re
from datetime import datetime
from typing import Dict, Any, List
from duckduckgo_search import DDGS

WORKSPACE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "workspace"))
DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
NOTES_FILE = os.path.join(DATA_DIR, "notes.json")

os.makedirs(WORKSPACE_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)

# ----------------- CLEAN TOOL DEFINITIONS -----------------

TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the live web for recent information, news, tutorials, weather, prices, or answers using DuckDuckGo.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to look up on the web"
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Number of results to return (default: 5)",
                        "default": 5
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_webpage",
            "description": "Fetch text content from a given web URL for deep reading and analysis.",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "The full URL of the webpage to fetch"
                    }
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_python_code",
            "description": "Execute Python code to perform calculations, data analysis, solve algorithms, or create outputs. Returns stdout and stderr.",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "The Python code snippet to execute"
                    }
                },
                "required": ["code"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_terminal_command",
            "description": "Execute a shell / terminal command in the workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The terminal command line to execute"
                    }
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a file in the workspace.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {
                        "type": "string",
                        "description": "Relative or absolute path of the file"
                    }
                },
                "required": ["filepath"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Create or update a file with given text content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {
                        "type": "string",
                        "description": "Relative or absolute path of the file to write"
                    },
                    "content": {
                        "type": "string",
                        "description": "Content to write into the file"
                    }
                },
                "required": ["filepath", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List files and directories in a given folder.",
            "parameters": {
                "type": "object",
                "properties": {
                    "directory": {
                        "type": "string",
                        "description": "Directory path to list. Defaults to current workspace.",
                        "default": "."
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "manage_notes",
            "description": "Save, read, or delete personal notes, reminders, and to-do items.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["add", "list", "delete"],
                        "description": "The action to perform on notes"
                    },
                    "title": {
                        "type": "string",
                        "description": "Title or summary of the note (for add/delete)"
                    },
                    "content": {
                        "type": "string",
                        "description": "Detailed content of the note (for add)"
                    }
                },
                "required": ["action"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_ai_image",
            "description": "Generate an AI image using OpenAI DALL-E 3 based on a creative prompt.",
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "A detailed description of the image to generate"
                    },
                    "size": {
                        "type": "string",
                        "enum": ["1024x1024", "1024x1792", "1792x1024"],
                        "default": "1024x1024",
                        "description": "Size of the image"
                    }
                },
                "required": ["prompt"]
            }
        }
    }
]

# ----------------- TOOL IMPLEMENTATIONS -----------------

def tool_web_search(query: str, max_results: int = 5) -> Dict[str, Any]:
    try:
        ddgs = DDGS()
        results = list(ddgs.text(query, max_results=max_results))
        if not results:
            return {"status": "success", "results": "No results found for query."}
        formatted = []
        for r in results:
            formatted.append({
                "title": r.get("title", ""),
                "snippet": r.get("body", ""),
                "url": r.get("href", "")
            })
        return {"status": "success", "results": formatted}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def tool_fetch_webpage(url: str) -> Dict[str, Any]:
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        text = resp.text
        text = re.sub(r'<script.*?</script>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<style.*?</style>', '', text, flags=re.DOTALL | re.IGNORECASE)
        text = re.sub(r'<[^>]+>', ' ', text)
        clean_text = ' '.join(text.split())
        return {"status": "success", "url": url, "content": clean_text[:4000]}
    except Exception as e:
        return {"status": "error", "message": f"Failed to fetch webpage: {str(e)}"}

def tool_run_python_code(code: str) -> Dict[str, Any]:
    try:
        code_file = os.path.join(WORKSPACE_DIR, "_temp_script.py")
        with open(code_file, "w", encoding="utf-8") as f:
            f.write(code)
        
        proc = subprocess.run(
            [sys.executable, code_file],
            cwd=WORKSPACE_DIR,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=30
        )
        return {
            "status": "success",
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "exit_code": proc.returncode
        }
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "Code execution timed out after 30 seconds."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def tool_run_terminal_command(command: str) -> Dict[str, Any]:
    try:
        proc = subprocess.run(
            command,
            shell=True,
            cwd=WORKSPACE_DIR,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=30
        )
        return {
            "status": "success",
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "exit_code": proc.returncode
        }
    except subprocess.TimeoutExpired:
        return {"status": "error", "message": "Command timed out after 30 seconds."}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def _resolve_path(path: str) -> str:
    if os.path.isabs(path):
        return path
    return os.path.abspath(os.path.join(WORKSPACE_DIR, path))

def tool_read_file(filepath: str) -> Dict[str, Any]:
    try:
        target = _resolve_path(filepath)
        if not os.path.exists(target):
            return {"status": "error", "message": f"File not found: {filepath}"}
        with open(target, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        return {"status": "success", "filepath": target, "content": content}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def tool_write_file(filepath: str, content: str) -> Dict[str, Any]:
    try:
        target = _resolve_path(filepath)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, "w", encoding="utf-8") as f:
            f.write(content)
        return {"status": "success", "message": f"File successfully written to {target}", "filepath": target}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def tool_list_files(directory: str = ".") -> Dict[str, Any]:
    try:
        target = _resolve_path(directory)
        if not os.path.exists(target):
            return {"status": "error", "message": f"Directory not found: {directory}"}
        items = []
        for name in os.listdir(target):
            full = os.path.join(target, name)
            items.append({
                "name": name,
                "is_dir": os.path.isdir(full),
                "size_bytes": os.path.getsize(full) if not os.path.isdir(full) else None
            })
        return {"status": "success", "directory": target, "items": items}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def tool_manage_notes(action: str, title: str = "", content: str = "") -> Dict[str, Any]:
    try:
        notes = []
        if os.path.exists(NOTES_FILE):
            try:
                with open(NOTES_FILE, "r", encoding="utf-8") as f:
                    notes = json.load(f)
            except:
                notes = []
        
        if action == "list":
            return {"status": "success", "notes": notes}
        elif action == "add":
            new_note = {
                "id": str(int(datetime.now().timestamp() * 1000)),
                "title": title or "Untitled Note",
                "content": content,
                "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
            notes.append(new_note)
            with open(NOTES_FILE, "w", encoding="utf-8") as f:
                json.dump(notes, f, indent=2)
            return {"status": "success", "message": "Note saved successfully.", "note": new_note}
        elif action == "delete":
            notes = [n for n in notes if n.get("title") != title and n.get("id") != title]
            with open(NOTES_FILE, "w", encoding="utf-8") as f:
                json.dump(notes, f, indent=2)
            return {"status": "success", "message": f"Note removed."}
        else:
            return {"status": "error", "message": f"Unknown action: {action}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def tool_generate_ai_image(prompt: str, size: str = "1024x1024", api_key: str = None) -> Dict[str, Any]:
    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))
        response = client.images.generate(
            model="dall-e-3",
            prompt=prompt,
            size=size,
            quality="standard",
            n=1,
        )
        image_url = response.data[0].url
        return {"status": "success", "image_url": image_url, "prompt": prompt}
    except Exception as e:
        return {"status": "error", "message": f"Image generation failed: {str(e)}"}

# ----------------- DISPATCHER -----------------

def execute_tool(name: str, args: Dict[str, Any], api_key: str = None) -> Dict[str, Any]:
    if name == "web_search":
        return tool_web_search(args.get("query", ""), args.get("max_results", 5))
    elif name == "fetch_webpage":
        return tool_fetch_webpage(args.get("url", ""))
    elif name == "run_python_code":
        return tool_run_python_code(args.get("code", ""))
    elif name == "run_terminal_command":
        return tool_run_terminal_command(args.get("command", ""))
    elif name == "read_file":
        return tool_read_file(args.get("filepath", ""))
    elif name == "write_file":
        return tool_write_file(args.get("filepath", ""), args.get("content", ""))
    elif name == "list_files":
        return tool_list_files(args.get("directory", "."))
    elif name == "manage_notes":
        return tool_manage_notes(args.get("action", "list"), args.get("title", ""), args.get("content", ""))
    elif name == "generate_ai_image":
        return tool_generate_ai_image(args.get("prompt", ""), args.get("size", "1024x1024"), api_key=api_key)
    else:
        return {"status": "error", "message": f"Unknown tool: {name}"}
