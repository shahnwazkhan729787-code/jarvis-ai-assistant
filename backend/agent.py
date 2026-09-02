import os
import json
import asyncio
from typing import List, Dict, Any, AsyncGenerator
from openai import OpenAI
from backend.tools import TOOLS_SCHEMA, execute_tool

SHAHNAWAZ_SYSTEM_PROMPT = """You are JARVIS / SAKSHI — the dedicated, ultra-fast, intelligent Personal AI Assistant created and developed by Shahnawaz.

Developer Credit Rule:
- If anyone asks who created or developed you: Always answer: "Mujhe **Shahnawaz** (BCA Second Year Student) ne develop kiya hai!"

User Profile:
- Creator & User Name: Shahnawaz (शाहनवाज़)
- Education: 2nd Year BCA Student.

Capabilities & Tools:
1. web_search / fetch_webpage: Search live internet facts, news, documentation, scores, weather.
2. run_python_code / run_terminal_command: Run code snippets and algorithms.
3. read_file / write_file / list_files / manage_notes: Manage files and to-do notes.

Pronunciation & Speech Rules:
- Write "Second Year" (not "2nd year" or "do nd") and "B C A" so speech synthesis reads fluently.
- Address Shahnawaz respectfully and warmly as "Shahnawaz" or "Shahnawaz bhai".
- Language: Speak naturally in friendly Hindi / Hinglish. If he speaks in English, reply in English.
- Be super concise, smart, energetic, and helpful."""

GROQ_FALLBACK_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b", "groq/compound"]

class AIAssistantAgent:
    def __init__(self, api_key: str = None, model: str = "openai/gpt-oss-120b", provider: str = "groq"):
        self.api_key = api_key or os.getenv("AI_API_KEY", "")
        self.model = model or os.getenv("AI_MODEL", "openai/gpt-oss-120b")
        self.provider = provider or os.getenv("AI_PROVIDER", "groq")
        self.system_prompt = SHAHNAWAZ_SYSTEM_PROMPT

    def get_client_config(self, api_key: str = None, provider: str = None, model: str = None):
        key = (api_key or self.api_key or os.getenv("AI_API_KEY", "")).strip()
        prov = provider or self.provider or "groq"
        selected_model = model or self.model or "openai/gpt-oss-120b"

        if not key:
            raise ValueError("API Key missing hai! Please Settings me jakar Groq API key paste karein.")

        if key.startswith("gsk_"):
            prov = "groq"
            base_url = "https://api.groq.com/openai/v1"
            if "gpt-4" in selected_model or "llama" in selected_model or not selected_model:
                selected_model = "openai/gpt-oss-120b"
        elif key.startswith("sk-or-"):
            prov = "openrouter"
            base_url = "https://openrouter.ai/api/v1"
        elif key.startswith("sk-"):
            prov = "openai"
            base_url = None
            if "oss" in selected_model or "llama" in selected_model:
                selected_model = "gpt-4o-mini"
        else:
            if prov == "groq":
                base_url = "https://api.groq.com/openai/v1"
                if "gpt-4" in selected_model or "llama" in selected_model:
                    selected_model = "openai/gpt-oss-120b"
            elif prov == "openrouter":
                base_url = "https://openrouter.ai/api/v1"
            else:
                base_url = None

        client = OpenAI(api_key=key, base_url=base_url)
        return client, key, prov, selected_model

    async def chat_stream(
        self,
        messages: List[Dict[str, Any]],
        api_key: str = None,
        model: str = None,
        provider: str = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        active_key = api_key or self.api_key
        active_prov = provider or self.provider
        active_model = model or self.model

        try:
            client, active_key, active_prov, active_model = self.get_client_config(active_key, active_prov, active_model)
        except Exception as e:
            yield {"event": "error", "data": {"message": str(e)}}
            return

        full_messages = [{"role": "system", "content": self.system_prompt}]
        for m in messages:
            full_messages.append({"role": m["role"], "content": m["content"]})

        max_iterations = 6
        iteration = 0

        while iteration < max_iterations:
            iteration += 1
            response = None
            
            models_to_try = [active_model]
            if active_prov == "groq":
                for fm in GROQ_FALLBACK_MODELS:
                    if fm not in models_to_try:
                        models_to_try.append(fm)

            last_err = None
            for try_model in models_to_try:
                try:
                    response = await asyncio.to_thread(
                        client.chat.completions.create,
                        model=try_model,
                        messages=full_messages,
                        tools=TOOLS_SCHEMA,
                        tool_choice="auto",
                        temperature=0.6,
                        max_tokens=800,
                    )
                    active_model = try_model
                    break
                except Exception as e:
                    last_err = e
                    err_str = str(e).lower()
                    if "tool" in err_str or "schema" in err_str:
                        try:
                            response = await asyncio.to_thread(
                                client.chat.completions.create,
                                model=try_model,
                                messages=full_messages,
                                temperature=0.6,
                                max_tokens=800,
                            )
                            active_model = try_model
                            break
                        except Exception as e2:
                            last_err = e2
                    continue

            if response is None:
                yield {"event": "error", "data": {"message": f"API Error: {str(last_err)}"}}
                return

            choice = response.choices[0]
            message = choice.message

            if message.tool_calls:
                full_messages.append(message.to_dict())

                for tool_call in message.tool_calls:
                    fn_name = tool_call.function.name
                    raw_args = tool_call.function.arguments
                    try:
                        args = json.loads(raw_args)
                    except:
                        args = {}

                    yield {
                        "event": "tool_call",
                        "data": {
                            "id": tool_call.id,
                            "tool": fn_name,
                            "args": args
                        }
                    }

                    tool_result = await asyncio.to_thread(
                        execute_tool, fn_name, args, active_key
                    )

                    yield {
                        "event": "tool_result",
                        "data": {
                            "id": tool_call.id,
                            "tool": fn_name,
                            "result": tool_result
                        }
                    }

                    full_messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": json.dumps(tool_result, ensure_ascii=False)
                    })

                continue
            else:
                content = message.content or ""
                words = content.split(" ")
                for i in range(0, len(words), 3):
                    chunk = " ".join(words[i:i+3]) + " "
                    yield {"event": "token", "data": {"token": chunk}}
                    await asyncio.sleep(0.005)

                yield {
                    "event": "done",
                    "data": {
                        "content": content,
                        "model": active_model
                    }
                }
                break
