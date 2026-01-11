// script.js - Handles Voice Input with Robust Error Handling

const recordBtn = document.getElementById('recordBtn');
const finalTranscriptEl = document.getElementById('final-transcript');
const interimTranscriptEl = document.getElementById('interim-transcript');
const statusEl = document.getElementById('status');
const processBtn = document.getElementById('processBtn');
const langSelect = document.getElementById('lang-select');
const hfTokenInput = document.getElementById('hf-token-input');

// Result Display
const apiResult = document.getElementById('api-result');
const resLang = document.getElementById('res-lang');
const resTrans = document.getElementById('res-trans');

let recognition;
let isRecording = false;
let finalTranscript = '';

// comprehensive browser check
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = function () {
        isRecording = true;
        recordBtn.classList.add('recording');
        statusEl.textContent = "Recording... (Speak now)";
        statusEl.style.color = "#ef4444"; // Red for recording
    };

    recognition.onend = function () {
        isRecording = false;
        recordBtn.classList.remove('recording');
        statusEl.textContent = "Recording stopped. Click 'Generate MoM' to process.";
        statusEl.style.color = "#333";

        // If stopped but mistakenly (not by user), prompt? 
        // For now, assume user clicked stop.
    };

    recognition.onresult = function (event) {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }
        finalTranscriptEl.innerText = finalTranscript;
        interimTranscriptEl.innerText = interimTranscript;
    };

    recognition.onerror = function (event) {
        console.error("Speech Recognition Error:", event.error);
        isRecording = false;
        recordBtn.classList.remove('recording');

        let msg = "Error occurred in recognition: " + event.error;
        if (event.error === 'not-allowed') {
            msg = "Microphone access denied. Please allow microphone permissions.";
        } else if (event.error === 'no-speech') {
            msg = "No speech detected. Please try again.";
        } else if (event.error === 'network') {
            msg = "Network error. Check your connection.";
        }

        statusEl.textContent = msg;
        statusEl.style.color = "red";
    };

} else {
    console.error("Web Speech API not supported.");
    statusEl.textContent = "Your browser does not support Voice Recognition. Please use Chrome.";
    recordBtn.disabled = true;
}

recordBtn.addEventListener('click', () => {
    if (!recognition) {
        alert("Voice recognition not supported.");
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
        recognition.lang = langSelect.value;

        try {
            recognition.start();
        } catch (e) {
            console.error("Start error:", e);
            statusEl.textContent = "Could not start recording. Refresh page.";
        }
    }
});

processBtn.addEventListener('click', () => {
    const text = finalTranscriptEl.innerText.trim();
    if (!text) {
        alert("Please record some text first.");
        return;
    }

    statusEl.innerHTML = '<div class="loader"></div> Processing... Please wait.';
    processBtn.disabled = true;
    apiResult.style.display = 'none';

    console.log("Sending text to process:", text.substring(0, 50) + "...");

    fetch('/api/process_voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            text: text,
            hf_token: hfTokenInput.value.trim()
        })
    })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error || 'Server Error'); });
            }
            return response.json();
        })
        .then(data => {
            console.log("Server response:", data);
            statusEl.textContent = "Processing Complete!";
            processBtn.disabled = false;

            // Show result preview
            apiResult.style.display = 'block';
            resLang.textContent = data.language || "Unknown";
            resTrans.textContent = data.translated || "Translation unavailable";
        })
        .catch(err => {
            console.error("Processing Error:", err);
            statusEl.textContent = "Error processing: " + err.message;
            processBtn.disabled = false;
        });
});
