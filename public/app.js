// State
let conversationHistory = [];
let voiceOutputEnabled = true;
let isGenerating = false;
let currentUploadedFile = null;
let currentRecognition = null;
let isRecording = false;

// Voice Call Mode State
let isCallActive = false;
let isCallMicMuted = false;
let isCallSpeakerMuted = false;
let callRecognition = null;

// Provider Models Mapping
const PROVIDER_MODELS = {
  groq: [
    { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B (Free, Super Smart - Recommended)" },
    { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B (Free, Ultra Fast)" },
    { id: "qwen/qwen3.8-27b", name: "Qwen 3.8 27B (Free, Multilingual)" },
    { id: "groq/compound", name: "Groq Compound (Free)" }
  ],
  openrouter: [
    { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B (Free)" },
    { id: "deepseek/deepseek-chat:free", name: "DeepSeek V3 (Free)" }
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o (Paid)" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini (Paid)" }
  ]
};

// DOM Elements
const messagesContainer = document.getElementById("messages-container");
const welcomeHero = document.getElementById("welcome-hero");
const userInput = document.getElementById("user-input");
const btnSend = document.getElementById("btn-send");
const btnMic = document.getElementById("btn-mic");
const btnVoiceOutput = document.getElementById("btn-voice-output");
const btnClearChat = document.getElementById("btn-clear-chat");
const activeModelTag = document.getElementById("active-model-tag");

// Voice Call Mode Elements
const voiceCallModal = document.getElementById("voice-call-modal");
const btnStartCall = document.getElementById("btn-start-call");
const btnNavCall = document.getElementById("btn-nav-call");
const btnHeroCall = document.getElementById("btn-hero-call");
const btnCloseCall = document.getElementById("btn-close-call");
const btnCallHangup = document.getElementById("btn-call-hangup");
const btnCallMicToggle = document.getElementById("btn-call-mic-toggle");
const btnCallSpeakerToggle = document.getElementById("btn-call-speaker-toggle");
const callStatusText = document.getElementById("call-status-text");
const callUserText = document.getElementById("call-user-text");
const callAiText = document.getElementById("call-ai-text");
const reactorOrb = document.getElementById("reactor-orb");
const soundWaveBars = document.getElementById("sound-wave-bars");

// Settings Elements
const settingsModal = document.getElementById("settings-modal");
const btnOpenSettings = document.getElementById("btn-open-settings");
const btnTopSettings = document.getElementById("btn-top-settings");
const btnCloseSettings = document.getElementById("btn-close-settings");
const selectProvider = document.getElementById("select-provider");
const inputApiKey = document.getElementById("input-api-key");
const selectModel = document.getElementById("select-model");
const inputSystemPrompt = document.getElementById("input-system-prompt");
const btnSaveSettings = document.getElementById("btn-save-settings");
const settingsStatus = document.getElementById("settings-status");
const btnToggleEye = document.getElementById("btn-toggle-eye");

// Attach & Upload
const btnAttachFile = document.getElementById("btn-attach-file");
const fileInput = document.getElementById("file-input");
const uploadPreview = document.getElementById("upload-preview");
const uploadFilename = document.getElementById("upload-filename");
const btnRemoveUpload = document.getElementById("btn-remove-upload");

// Right Drawer
const rightDrawer = document.getElementById("right-drawer");
const btnCloseDrawer = document.getElementById("btn-close-drawer");
const drawerTitle = document.getElementById("drawer-title");
const drawerNotesView = document.getElementById("drawer-notes-view");
const drawerWorkspaceView = document.getElementById("drawer-workspace-view");
const btnNavChat = document.getElementById("btn-nav-chat");
const btnNavNotes = document.getElementById("btn-nav-notes");
const btnNavWorkspace = document.getElementById("btn-nav-workspace");
const notesList = document.getElementById("notes-list");
const filesList = document.getElementById("files-list");
const newNoteTitle = document.getElementById("new-note-title");
const newNoteContent = document.getElementById("new-note-content");
const btnSaveNote = document.getElementById("btn-save-note");
const btnRefreshWorkspace = document.getElementById("btn-refresh-workspace");

// Markdown Parser
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true
});

function updateModelOptions(provider, selectedModel = null) {
  const models = PROVIDER_MODELS[provider] || PROVIDER_MODELS["groq"];
  selectModel.innerHTML = "";
  models.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m.id;
    opt.textContent = m.name;
    if (selectedModel && selectedModel === m.id) opt.selected = true;
    selectModel.appendChild(opt);
  });
}

// ----------------- INIT & SETTINGS -----------------

async function loadSettings() {
  try {
    const res = await fetch("/api/settings");
    if (!res.ok) return;
    const data = await res.json();
    if (data.provider) selectProvider.value = data.provider;
    updateModelOptions(selectProvider.value, data.model || "openai/gpt-oss-120b");

    if (data.model) {
      activeModelTag.textContent = `${(data.provider || "GROQ").toUpperCase()} : ${data.model}`;
    }
    if (data.system_prompt) inputSystemPrompt.value = data.system_prompt;
    if (data.has_api_key && data.masked_key) {
      inputApiKey.placeholder = `Saved: ${data.masked_key}`;
    }
  } catch (err) {
    console.error("Failed to load settings:", err);
  }
}

async function saveSettings() {
  settingsStatus.textContent = "Saving...";
  try {
    const payload = {
      provider: selectProvider.value,
      model: selectModel.value,
      system_prompt: inputSystemPrompt.value
    };
    if (inputApiKey.value.trim()) payload.api_key = inputApiKey.value.trim();
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    settingsStatus.textContent = "Saved & Connected!";
    activeModelTag.textContent = `${selectProvider.value.toUpperCase()} : ${selectModel.value}`;
    setTimeout(() => {
      settingsStatus.textContent = "";
      settingsModal.classList.remove("open");
    }, 1000);
  } catch (err) {
    settingsStatus.textContent = "Error saving settings";
  }
}

// ----------------- CHAT & STREAMING -----------------

function appendMessage(role, text = "") {
  if (welcomeHero) welcomeHero.style.display = "none";

  const row = document.createElement("div");
  row.className = `message-row ${role}`;

  const avatar = document.createElement("div");
  avatar.className = `avatar ${role === "user" ? "user-avatar" : "ai-avatar"}`;
  avatar.innerHTML = role === "user" ? '<i class="fa-solid fa-user"></i>' : '<img src="logo.png" style="width:28px;height:28px;border-radius:50%;" />';

  const contentBox = document.createElement("div");
  contentBox.className = "message-content";

  if (role === "user") {
    contentBox.textContent = text;
  } else {
    contentBox.innerHTML = marked.parse(text || "");
  }

  row.appendChild(avatar);
  row.appendChild(contentBox);
  messagesContainer.appendChild(row);
  scrollToBottom();

  return contentBox;
}

function appendToolBadge(container, toolName, args) {
  const badge = document.createElement("div");
  badge.className = "tool-status-card";
  let label = toolName;
  if (toolName === "web_search") label = `Searching live web: "${args.query || ''}"`;
  else if (toolName === "fetch_webpage") label = `Reading webpage: ${args.url || ''}`;
  else if (toolName === "run_python_code") label = `Executing Python code...`;
  else if (toolName === "run_terminal_command") label = `Running command: ${args.command || ''}`;
  else if (toolName === "write_file") label = `Writing file: ${args.filepath || ''}`;
  else if (toolName === "read_file") label = `Reading file: ${args.filepath || ''}`;
  else if (toolName === "list_files") label = `Listing files...`;
  else if (toolName === "manage_notes") label = `Managing notes...`;

  badge.innerHTML = `
    <div class="tool-spinner"></div>
    <span><strong class="tool-name">[Tool]</strong> ${label}</span>
  `;
  container.appendChild(badge);
  scrollToBottom();
  return badge;
}

async function sendMessage(textToSend = null) {
  const text = (textToSend || userInput.value).trim();
  if (!text && !currentUploadedFile) return;
  if (isGenerating) return;

  userInput.value = "";
  autoResizeTextarea();

  let fullPrompt = text;
  if (currentUploadedFile) {
    fullPrompt = `[Uploaded File: ${currentUploadedFile.filename} (${currentUploadedFile.filepath})]\n${text}`;
    currentUploadedFile = null;
    uploadPreview.style.display = "none";
  }

  appendMessage("user", fullPrompt);
  conversationHistory.push({ role: "user", content: fullPrompt });

  const assistantBox = appendMessage("assistant", "");
  isGenerating = true;
  btnSend.disabled = true;

  let currentResponseText = "";
  let activeToolBadges = {};

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: conversationHistory,
        provider: selectProvider.value,
        model: selectModel.value
      })
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        const eventMatch = line.match(/^event:\s*(.+)$/m);
        const dataMatch = line.match(/^data:\s*(.+)$/m);

        if (eventMatch && dataMatch) {
          const eventType = eventMatch[1].trim();
          let dataObj = {};
          try { dataObj = JSON.parse(dataMatch[1]); } catch (e) {}

          if (eventType === "token") {
            currentResponseText += dataObj.token || "";
            assistantBox.innerHTML = marked.parse(currentResponseText);
            scrollToBottom();
          } else if (eventType === "tool_call") {
            const badge = appendToolBadge(assistantBox, dataObj.tool, dataObj.args);
            activeToolBadges[dataObj.id] = badge;
          } else if (eventType === "tool_result") {
            const badge = activeToolBadges[dataObj.id];
            if (badge) {
              const spinner = badge.querySelector(".tool-spinner");
              if (spinner) spinner.style.display = "none";
              const check = document.createElement("i");
              check.className = "fa-solid fa-check";
              check.style.color = "var(--success)";
              badge.prepend(check);
            }
          } else if (eventType === "done") {
            currentResponseText = dataObj.content || currentResponseText;
            assistantBox.innerHTML = marked.parse(currentResponseText);
            conversationHistory.push({ role: "assistant", content: currentResponseText });
            if (voiceOutputEnabled) {
              speakText(currentResponseText);
            }
          } else if (eventType === "error") {
            assistantBox.innerHTML += `<p style="color:var(--danger)"><i class="fa-solid fa-triangle-exclamation"></i> ${dataObj.message}</p>`;
          }
        }
      }
    }
  } catch (err) {
    assistantBox.innerHTML = `<p style="color:var(--danger)"><i class="fa-solid fa-circle-exclamation"></i> Error: ${err.message}</p>`;
  } finally {
    isGenerating = false;
    btnSend.disabled = false;
    scrollToBottom();
  }
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ----------------- FAST TTS (SPEECH SYNTHESIS CLEANER) -----------------

function cleanTextForSpeech(text) {
  if (!text) return "";
  let clean = text;
  
  clean = clean.replace(/\b2nd\s*year\b/gi, "Second Year");
  clean = clean.replace(/\b1st\s*year\b/gi, "First Year");
  clean = clean.replace(/\b3rd\s*year\b/gi, "Third Year");
  clean = clean.replace(/\b4th\s*year\b/gi, "Fourth Year");

  clean = clean.replace(/\b2nd\b/gi, "Second");
  clean = clean.replace(/\b1st\b/gi, "First");
  clean = clean.replace(/\b3rd\b/gi, "Third");
  clean = clean.replace(/\b4th\b/gi, "Fourth");

  clean = clean.replace(/\bBCA\b/g, "B C A");
  
  clean = clean.replace(/[*#`_~\[\]()<>]/g, " ").trim();
  clean = clean.replace(/\s+/g, " ");
  return clean;
}

function getIndianVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(v => v.lang === "hi-IN" || v.lang === "hi_IN") ||
    voices.find(v => v.lang.includes("hi") || v.lang.includes("IN") || v.name.includes("India") || v.name.includes("Hindi")) ||
    voices.find(v => v.lang.includes("en-US") || v.lang.includes("en-GB")) ||
    voices[0]
  );
}

function speakText(text, onComplete = null) {
  if (!("speechSynthesis" in window)) {
    if (onComplete) onComplete();
    return;
  }
  const clean = cleanTextForSpeech(text);
  if (!clean) {
    if (onComplete) onComplete();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate = 1.25;
  utterance.pitch = 1.05;

  const voice = getIndianVoice();
  if (voice) utterance.voice = voice;

  utterance.onend = () => {
    if (onComplete) onComplete();
  };
  utterance.onerror = () => {
    if (onComplete) onComplete();
  };

  window.speechSynthesis.speak(utterance);
}

// ----------------- LIVE HANDS-FREE VOICE CALL MODE -----------------

function initCallRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;

  const rec = new SpeechRecognition();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = "hi-IN";

  rec.onstart = () => {
    if (!isCallActive) return;
    callStatusText.textContent = "JARVIS SUN RAHA HAI... (Shahnawaz Boliye)";
    reactorOrb.className = "reactor-orb listening";
    soundWaveBars.className = "sound-wave-bars active";
  };

  rec.onresult = (event) => {
    const transcript = Array.from(event.results).map(r => r[0].transcript).join("");
    callUserText.textContent = `Shahnawaz: "${transcript}"`;
    if (event.results[0].isFinal) {
      handleVoiceCallTurn(transcript);
    }
  };

  rec.onerror = (e) => {
    console.warn("Call speech error:", e.error);
    if (isCallActive && !isCallMicMuted) {
      setTimeout(listenInCall, 500);
    }
  };

  rec.onend = () => {
    if (isCallActive && !isGenerating && !window.speechSynthesis.speaking && !isCallMicMuted) {
      setTimeout(listenInCall, 300);
    }
  };

  return rec;
}

function listenInCall() {
  if (!isCallActive || isCallMicMuted || isGenerating || window.speechSynthesis.speaking) return;
  try {
    callRecognition.start();
  } catch (e) {}
}

async function handleVoiceCallTurn(userSpeech) {
  if (!userSpeech || !userSpeech.trim()) {
    listenInCall();
    return;
  }

  try {
    callRecognition.stop();
  } catch (e) {}

  reactorOrb.className = "reactor-orb";
  soundWaveBars.className = "sound-wave-bars";
  callStatusText.textContent = "JARVIS SOCH RAHA HAI...";
  isGenerating = true;

  conversationHistory.push({ role: "user", content: userSpeech });
  appendMessage("user", userSpeech);

  let fullAiResponse = "";
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: conversationHistory,
        provider: selectProvider.value,
        model: selectModel.value
      })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        const eventMatch = line.match(/^event:\s*(.+)$/m);
        const dataMatch = line.match(/^data:\s*(.+)$/m);
        if (eventMatch && dataMatch) {
          const ev = eventMatch[1].trim();
          let dataObj = {};
          try { dataObj = JSON.parse(dataMatch[1]); } catch (e) {}
          if (ev === "token") {
            fullAiResponse += dataObj.token || "";
            callAiText.textContent = `Jarvis: "${fullAiResponse}"`;
          } else if (ev === "done") {
            fullAiResponse = dataObj.content || fullAiResponse;
            callAiText.textContent = `Jarvis: "${fullAiResponse}"`;
          }
        }
      }
    }

    conversationHistory.push({ role: "assistant", content: fullAiResponse });
    appendMessage("assistant", fullAiResponse);

    if (!isCallSpeakerMuted) {
      callStatusText.textContent = "JARVIS BOL RAHA HAI...";
      reactorOrb.className = "reactor-orb speaking";
      soundWaveBars.className = "sound-wave-bars active";

      speakText(fullAiResponse, () => {
        if (isCallActive) {
          reactorOrb.className = "reactor-orb listening";
          callStatusText.textContent = "JARVIS SUN RAHA HAI... (Shahnawaz Boliye)";
          setTimeout(listenInCall, 200);
        }
      });
    } else {
      setTimeout(listenInCall, 300);
    }
  } catch (err) {
    callAiText.textContent = `Error: ${err.message}`;
    setTimeout(listenInCall, 800);
  } finally {
    isGenerating = false;
  }
}

function startVoiceCall() {
  isCallActive = true;
  voiceCallModal.classList.add("active");
  callUserText.textContent = "Shahnawaz boliye, Jarvis sun raha hai...";
  callAiText.textContent = "";

  if (!callRecognition) {
    callRecognition = initCallRecognition();
  }

  // Greeting
  const greeting = "Namaste Shahnawaz bhai! Main aapka personal AI assistant Sakshi hoon. BCA Second Year ki padhai aur coding me aaj kya madad karun?";
  callAiText.textContent = `Jarvis: "${greeting}"`;
  reactorOrb.className = "reactor-orb speaking";
  soundWaveBars.className = "sound-wave-bars active";

  speakText(greeting, () => {
    if (isCallActive) {
      listenInCall();
    }
  });
}

function endVoiceCall() {
  isCallActive = false;
  voiceCallModal.classList.remove("active");
  if (callRecognition) {
    try { callRecognition.stop(); } catch (e) {}
  }
  if (window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

// ----------------- STANDARD MIC BUTTON -----------------

function initStandardSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    btnMic.style.display = "none";
    return;
  }

  currentRecognition = new SpeechRecognition();
  currentRecognition.continuous = false;
  currentRecognition.interimResults = false;
  currentRecognition.lang = "hi-IN";

  currentRecognition.onstart = () => {
    isRecording = true;
    btnMic.classList.add("listening");
  };
  currentRecognition.onresult = (e) => {
    userInput.value = e.results[0][0].transcript;
    autoResizeTextarea();
    setTimeout(() => sendMessage(), 300);
  };
  currentRecognition.onerror = () => stopRecording();
  currentRecognition.onend = () => stopRecording();
}

function toggleRecording() {
  if (!currentRecognition) return;
  if (isRecording) currentRecognition.stop();
  else {
    try { currentRecognition.start(); } catch (e) {}
  }
}
function stopRecording() {
  isRecording = false;
  btnMic.classList.remove("listening");
}

// ----------------- NOTES & WORKSPACE -----------------

async function loadNotes() {
  try {
    const res = await fetch("/api/notes");
    const data = await res.json();
    notesList.innerHTML = "";
    if (data.notes && data.notes.length > 0) {
      data.notes.forEach(note => {
        const item = document.createElement("div");
        item.className = "note-item";
        item.innerHTML = `
          <h4>${note.title}</h4>
          <p>${note.content || ''}</p>
          <small>${note.created_at || ''}</small>
          <button class="btn-delete-note" onclick="deleteNote('${note.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        `;
        notesList.appendChild(item);
      });
    } else {
      notesList.innerHTML = `<p style="color:var(--text-dim); text-align:center; padding:20px;">Koi notes nahi hain abhi.</p>`;
    }
  } catch (err) {}
}

async function addNote() {
  const title = newNoteTitle.value.trim();
  const content = newNoteContent.value.trim();
  if (!title) return;
  await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content })
  });
  newNoteTitle.value = "";
  newNoteContent.value = "";
  loadNotes();
}

window.deleteNote = async function(id) {
  await fetch(`/api/notes/${id}`, { method: "DELETE" });
  loadNotes();
};

async function loadWorkspaceFiles() {
  try {
    const res = await fetch("/api/workspace");
    const data = await res.json();
    filesList.innerHTML = "";
    if (data.items && data.items.length > 0) {
      data.items.forEach(file => {
        const item = document.createElement("div");
        item.className = "file-item";
        const icon = file.is_dir ? "fa-folder" : "fa-file-code";
        item.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px;">
            <i class="fa-solid ${icon}" style="color:var(--primary-cyan)"></i>
            <span style="color:#fff; font-weight:500;">${file.name}</span>
          </div>
          <small>${file.is_dir ? 'Folder' : (file.size_bytes + ' bytes')}</small>
        `;
        filesList.appendChild(item);
      });
    } else {
      filesList.innerHTML = `<p style="color:var(--text-dim); text-align:center; padding:20px;">Workspace folder is empty.</p>`;
    }
  } catch (err) {}
}

async function handleFileUpload(file) {
  if (!file) return;
  const formData = new FormData();
  formData.append("file", file);
  try {
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (data.status === "success") {
      currentUploadedFile = data;
      uploadFilename.textContent = file.name;
      uploadPreview.style.display = "inline-flex";
    }
  } catch (err) {
    alert("File upload failed: " + err.message);
  }
}

// ----------------- LISTENERS -----------------

document.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  initStandardSpeechRecognition();

  btnStartCall.addEventListener("click", startVoiceCall);
  btnNavCall.addEventListener("click", startVoiceCall);
  if (btnHeroCall) btnHeroCall.addEventListener("click", startVoiceCall);
  btnCloseCall.addEventListener("click", endVoiceCall);
  btnCallHangup.addEventListener("click", endVoiceCall);

  btnCallMicToggle.addEventListener("click", () => {
    isCallMicMuted = !isCallMicMuted;
    btnCallMicToggle.classList.toggle("muted", isCallMicMuted);
    btnCallMicToggle.innerHTML = isCallMicMuted ? '<i class="fa-solid fa-microphone-slash"></i>' : '<i class="fa-solid fa-microphone"></i>';
    if (!isCallMicMuted) listenInCall();
    else if (callRecognition) {
      try { callRecognition.stop(); } catch (e) {}
    }
  });

  btnCallSpeakerToggle.addEventListener("click", () => {
    isCallSpeakerMuted = !isCallSpeakerMuted;
    btnCallSpeakerToggle.classList.toggle("muted", isCallSpeakerMuted);
    btnCallSpeakerToggle.innerHTML = isCallSpeakerMuted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
    if (isCallSpeakerMuted && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  });

  selectProvider.addEventListener("change", () => {
    updateModelOptions(selectProvider.value);
  });

  document.querySelectorAll(".prompt-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      userInput.value = chip.getAttribute("data-prompt");
      sendMessage();
    });
  });

  userInput.addEventListener("input", autoResizeTextarea);
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  btnSend.addEventListener("click", () => sendMessage());
  btnMic.addEventListener("click", toggleRecording);

  btnVoiceOutput.addEventListener("click", () => {
    voiceOutputEnabled = !voiceOutputEnabled;
    btnVoiceOutput.classList.toggle("active", voiceOutputEnabled);
    if (!voiceOutputEnabled && window.speechSynthesis) window.speechSynthesis.cancel();
  });

  btnClearChat.addEventListener("click", () => {
    conversationHistory = [];
    messagesContainer.innerHTML = "";
    if (welcomeHero) {
      messagesContainer.appendChild(welcomeHero);
      welcomeHero.style.display = "block";
    }
  });

  btnAttachFile.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) handleFileUpload(e.target.files[0]);
  });
  btnRemoveUpload.addEventListener("click", () => {
    currentUploadedFile = null;
    uploadPreview.style.display = "none";
    fileInput.value = "";
  });

  btnNavChat.addEventListener("click", () => {
    btnNavChat.classList.add("active");
    btnNavNotes.classList.remove("active");
    btnNavWorkspace.classList.remove("active");
    rightDrawer.classList.remove("open");
  });

  btnNavNotes.addEventListener("click", () => {
    btnNavNotes.classList.add("active");
    btnNavChat.classList.remove("active");
    btnNavWorkspace.classList.remove("active");
    drawerTitle.textContent = "Notes & Reminders";
    drawerNotesView.style.display = "flex";
    drawerWorkspaceView.style.display = "none";
    rightDrawer.classList.add("open");
    loadNotes();
  });

  btnNavWorkspace.addEventListener("click", () => {
    btnNavWorkspace.classList.add("active");
    btnNavChat.classList.remove("active");
    btnNavNotes.classList.remove("active");
    drawerTitle.textContent = "Workspace Explorer";
    drawerNotesView.style.display = "none";
    drawerWorkspaceView.style.display = "flex";
    rightDrawer.classList.add("open");
    loadWorkspaceFiles();
  });

  btnCloseDrawer.addEventListener("click", () => {
    rightDrawer.classList.remove("open");
    btnNavChat.classList.add("active");
    btnNavNotes.classList.remove("active");
    btnNavWorkspace.classList.remove("active");
  });

  btnSaveNote.addEventListener("click", addNote);
  btnRefreshWorkspace.addEventListener("click", loadWorkspaceFiles);

  const openModal = () => {
    loadSettings();
    settingsModal.classList.add("open");
  };
  btnOpenSettings.addEventListener("click", openModal);
  btnTopSettings.addEventListener("click", openModal);
  btnCloseSettings.addEventListener("click", () => settingsModal.classList.remove("open"));
  btnSaveSettings.addEventListener("click", saveSettings);

  btnToggleEye.addEventListener("click", () => {
    const isPassword = inputApiKey.type === "password";
    inputApiKey.type = isPassword ? "text" : "password";
    btnToggleEye.innerHTML = isPassword ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
  });
});

function autoResizeTextarea() {
  userInput.style.height = "auto";
  userInput.style.height = Math.min(userInput.scrollHeight, 180) + "px";
}
