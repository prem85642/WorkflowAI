// script.js - v5 (Explicit Language Support)

const recordBtn = document.getElementById('recordBtn');
const finalTranscriptEl = document.getElementById('final-transcript');
const interimTranscriptEl = document.getElementById('interim-transcript');
const statusEl = document.getElementById('status');
const processBtn = document.getElementById('processBtn');
const langSelect = document.getElementById('lang-select');
const hfTokenInput = document.getElementById('hf-token-input');
const debugLog = document.getElementById('debug-log');

// Result Display
const apiResult = document.getElementById('api-result');
const resLang = document.getElementById('res-lang');
const resTrans = document.getElementById('res-trans');

let recognition;
let isRecording = false;
let finalTranscript = '';

// Debug Logger
function logDebug(msg) {
    console.log(msg);
    if (debugLog) {
        const line = document.createElement('div');
        line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        debugLog.appendChild(line);
        debugLog.scrollTop = debugLog.scrollHeight;
    }
}

window.toggleDebug = function () {
    if (debugLog && debugLog.style.display === 'none') {
        debugLog.style.display = 'block';
    } else if (debugLog) {
        debugLog.style.display = 'none';
    }
};

// Browser Support Check
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    logDebug("SpeechRecognition API found.");
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    // --- EVENT HANDLERS ---

    recognition.onstart = function () {
        logDebug("Event: onstart - Microphone active");
        isRecording = true;
        recordBtn.classList.add('recording');
        statusEl.textContent = "Recording... (Speak now)";
        statusEl.style.color = "#ef4444";
    };

    recognition.onend = function () {
        logDebug("Event: onend - Recording stopped");
        isRecording = false;
        recordBtn.classList.remove('recording');
        statusEl.textContent = "Stopped. Click 'Generate MoM' to process.";
        statusEl.style.color = "#333";
    };

    recognition.onresult = function (event) {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                const text = event.results[i][0].transcript;
                finalTranscript += text;
                logDebug(`Final Text captured: "${text}"`);
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        finalTranscriptEl.innerText = finalTranscript;
        interimTranscriptEl.innerText = interimTranscript;
    };

    recognition.onerror = function (event) {
        logDebug(`Event: onerror - ${event.error}`);
        isRecording = false;
        recordBtn.classList.remove('recording');

        let msg = "Error: " + event.error;
        if (event.error === 'not-allowed') {
            msg = "Microphone BLOCKED. Check browser permission/settings.";
        } else if (event.error === 'no-speech') {
            msg = "No speech detected. Please speak louder/closer.";
        } else if (event.error === 'network') {
            msg = "Network Error. Check internet connection.";
        }

        statusEl.textContent = msg;
        statusEl.style.color = "red";
    };

} else {
    logDebug("CRITICAL: Web Speech API NOT supported in this browser.");
    alert("Voice functionalities will NOT work in this browser. Please use Chrome.");
    statusEl.textContent = "Browser Not Supported. Use Chrome/Edge.";
    recordBtn.disabled = true;
}

// --- BUTTONS ---

recordBtn.addEventListener('click', () => {
    if (!recognition) {
        alert("Voice API not supported.");
        return;
    }

    if (isRecording) {
        recognition.stop();
    } else {
        // Reset buffers
        finalTranscript = '';
        finalTranscriptEl.innerText = '';
        interimTranscriptEl.innerText = '';

        // Update language
        const selectedLang = langSelect.value;
        recognition.lang = selectedLang; // Tell browser which language to listen for
        logDebug(`Language set to: ${selectedLang}`);

        try {
            recognition.start();
        } catch (e) {
            logDebug(`Exception on start: ${e.message}`);
            statusEl.textContent = "Error starting mic. Refresh page.";
        }
    }
});

processBtn.addEventListener('click', () => {
    const text = finalTranscriptEl.innerText.trim();
    const selectedLang = langSelect.value; // Capture selected language code (e.g., 'hi-IN', 'fr-FR')

    logDebug(`Process Clicked. Text length: ${text.length}, Source Lang: ${selectedLang}`);

    if (!text) {
        alert("Please record some text first.");
        return;
    }

    statusEl.innerHTML = '<div class="loader"></div> Processing...';
    processBtn.disabled = true;
    apiResult.style.display = 'none';

    fetch('/api/process_voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: text,
            source_lang_code: selectedLang, // SENDING THIS TO BACKEND
            hf_token: hfTokenInput.value.trim()
        })
    })
        .then(response => {
            if (!response.ok) return response.json().then(e => { throw new Error(e.error) });
            return response.json();
        })
        .then(data => {
            logDebug("Server Success provided response");
            statusEl.textContent = "Processing Complete!";
            processBtn.disabled = false;

            // Show result preview
            apiResult.style.display = 'block';
            resLang.textContent = data.language || "Unknown";
            resTrans.textContent = data.translated || "Translation unavailable";
        })
        .catch(err => {
            logDebug(`Server Error: ${err.message}`);
            statusEl.textContent = "Error processing: " + err.message;
            processBtn.disabled = false;
        });
});
