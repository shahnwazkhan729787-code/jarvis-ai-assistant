# 🤖 JARVIS — Autonomous Personal AI Assistant

A complete, futuristic, voice-enabled Personal AI Assistant powered by OpenAI's GPT-4o with function calling and autonomous tool execution.

---

## 🌟 Key Features

1. **🗣️ Voice & Text Chat (Hindi / Hinglish / English)**:
   - Real-time voice recognition (Speech-to-Text).
   - Natural spoken voice responses (Text-to-Speech).
   - Fluid Hindi, Hinglish, and English multi-turn conversations.

2. **🌐 Autonomous Tools ("Sab Kaam Kar Sake")**:
   - **Live Web Search**: Fetch real-time news, information, cricket scores, weather, and tutorials.
   - **Webpage Reader**: Deeply read and analyze any URL/article.
   - **Python Sandbox**: Run Python scripts, mathematical calculations, and algorithms dynamically.
   - **System Terminal Runner**: Execute commands safely inside the workspace.
   - **File Manager**: Read, write, and manage workspace files directly from chat.
   - **Notes & Reminders**: Save, review, and delete personal notes or tasks.
   - **DALL-E 3 Image Generation**: Create stunning AI images on demand.

3. **💻 Futuristic Web UI**:
   - Cyberpunk / Jarvis reactor dark aesthetic.
   - Live streaming response with tool execution status badges.
   - Settings modal for instant API key configuration & model switching.
   - Notes & Workspace file explorer side drawers.

---

## 🚀 How to Start (Kaise Chalayein)

### Method 1: 1-Click Launch (Sabse Aasan)
1. Folder me jaakar **`run.bat`** par double click karein.
2. Yeh browser me `http://127.0.0.1:8000` par open ho jayega.

### Method 2: Terminal se Start karein
```bash
cd jarvis-ai-assistant
python -m pip install -r requirements.txt
python -m uvicorn backend.server:app --host 127.0.0.1 --port 8000 --reload
```

---

## 🔑 OpenAI API Key Setup

1. Jab Assistant browser me open ho, upar right corner me **"API Key"** ya **"Settings"** icon par click karein.
2. Apni `sk-...` OpenAI API Key paste karein aur **"Save & Connect"** par click karein.
3. Ya fir `.env` file open karke wahan `OPENAI_API_KEY=your_key_here` daal sakte hain.

---

## 💡 Example Prompts to Try

- *"Aaj ki taaza cricket aur tech news batao"* (Triggers live DuckDuckGo web search)
- *"Ek Python script chalao jo 1 se 100 tak ke prime numbers calculate kare"* (Triggers Python sandbox execution)
- *"Mera ek note save karo: Kal morning 10 AM doctor appointment hai"* (Triggers Notes manager)
- *"Ek futuristic cyberpunk car ka photo generate karo"* (Triggers DALL-E 3 image generation)
- *"Ek file banao `notes.txt` aur usme project planning likho"* (Triggers file writer)
