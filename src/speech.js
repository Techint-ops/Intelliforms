/**
 * Intelliform — Speech Engine & Accessibility Persona Manager
 * Ownership: Person B (speech.js + persona/accessibility UI)
 * 
 * Owns:
 *  - Persona definitions & recommendation mappings (visual, nonverbal, hearing, locomotor)
 *  - Modality state machine (field presentation + details response modality)
 *  - Text-to-Speech (TTS) via Web Speech API (SpeechSynthesisUtterance)
 *  - Speech-to-Text (STT) via Web Speech API (SpeechRecognition / webkitSpeechRecognition)
 *  - Voice command processing ("next", "finish", "submit", "done")
 *  - ARIA live region announcements
 * 
 * Depends on:
 *  - Web Speech API (browser built-in)
 * 
 * Teammate Note:
 *  - Evaluator explanation: This module manages accessibility personas and handles multi-modal voice
 *    interaction. It coordinates screen reading prompts and hands-free voice-to-text input with
 *    built-in voice navigation commands.
 */

export const personaRecommendations = {
  visual: {
    field: "spoken",
    details: "spoken",
    note: "We recommend Spoken so you can hear fields read aloud and answer the same way.",
  },
  nonverbal: {
    field: "written",
    details: "signed",
    note: "We recommend Written fields and Hand-signed answers, since speaking isn't required.",
  },
  hearing: {
    field: "signed",
    details: "written",
    note: "We recommend Hand-signed fields so you can follow along visually, then answer in writing.",
  },
  locomotor: {
    field: "spoken",
    details: "spoken",
    note: "We recommend Spoken for both, so no typing is ever required.",
  },
};

export const state = {
  persona: null,
  field: null,
  details: null,
};

let recognition = null;
let isSpeaking = false;
let isListening = false;

export function getPersonaState() {
  return state;
}

export function labelFor(value) {
  if (value === "written") return "Written";
  if (value === "spoken") return "Spoken";
  if (value === "signed") return "Hand-signed";
  return "—";
}

export function personaLabelFor(key) {
  const map = {
    visual: "Visually impaired",
    nonverbal: "Non-verbal",
    hearing: "Hard of hearing",
    locomotor: "Locomotor disability",
  };
  return map[key] || "None selected";
}

export function announce(msg) {
  const liveRegion = document.getElementById("liveRegion");
  if (liveRegion) {
    liveRegion.textContent = msg;
  }
}

export function announceFill(msg) {
  const fillLiveRegion = document.getElementById("fillLiveRegion");
  if (fillLiveRegion) {
    fillLiveRegion.textContent = msg;
  }
}

export function updateSummary() {
  const summaryPersona = document.getElementById("summaryPersona");
  const summaryField = document.getElementById("summaryField");
  const summaryDetails = document.getElementById("summaryDetails");
  const startBtn = document.getElementById("startBtn");
  const ctaNote = document.getElementById("ctaNote");

  if (summaryPersona) summaryPersona.textContent = personaLabelFor(state.persona);
  if (summaryField) summaryField.textContent = labelFor(state.field);
  if (summaryDetails) summaryDetails.textContent = labelFor(state.details);

  const ready = state.field && state.details;
  if (startBtn) {
    if (ready) {
      startBtn.removeAttribute("aria-disabled");
    } else {
      startBtn.setAttribute("aria-disabled", "true");
    }
  }

  if (ctaNote) {
    ctaNote.textContent = ready
      ? "Field: " +
        labelFor(state.field) +
        "  ·  Answers: " +
        labelFor(state.details)
      : "Choose how fields are shown and how you'll answer to continue.";
  }
}

export function setOption(group, value, fromRecommendation) {
  state[group] = value;
  const optionBtns = document.querySelectorAll(".option-btn");
  optionBtns.forEach((btn) => {
    if (btn.dataset.group !== group) return;
    const match = btn.dataset.value === value;
    btn.setAttribute("aria-checked", match ? "true" : "false");

    const existingPill = btn.querySelector(".recommend-pill");
    if (existingPill) existingPill.remove();
    if (match && fromRecommendation) {
      const pill = document.createElement("span");
      pill.className = "recommend-pill";
      pill.textContent = "Recommended";
      btn.appendChild(pill);
    }
  });
  updateSummary();
}

export function applyRecommendation(group, value) {
  setOption(group, value, true);
}

export function setPersona(key) {
  const alreadySelected = state.persona === key;
  state.persona = alreadySelected ? null : key;

  const personaCards = document.querySelectorAll(".persona-card");
  const fieldHint = document.getElementById("fieldHint");
  const detailsHint = document.getElementById("detailsHint");

  personaCards.forEach((card) => {
    const isThis = card.dataset.persona === key;
    card.setAttribute(
      "aria-pressed",
      !alreadySelected && isThis ? "true" : "false",
    );
  });

  if (!alreadySelected && key) {
    const rec = personaRecommendations[key];
    applyRecommendation("field", rec.field);
    applyRecommendation("details", rec.details);
    if (fieldHint) fieldHint.textContent = rec.note;
    if (detailsHint) detailsHint.textContent = rec.note;
    announce(rec.note);
  } else {
    if (fieldHint) fieldHint.textContent = "";
    if (detailsHint) detailsHint.textContent = "";
  }

  updateSummary();
}

/**
 * Initialize persona selection cards and modality option radio buttons.
 */
export function initPersonaControls() {
  const personaCards = document.querySelectorAll(".persona-card");
  const optionBtns = document.querySelectorAll(".option-btn");

  personaCards.forEach((card) => {
    card.addEventListener("click", () => {
      setPersona(card.dataset.persona);
    });
  });

  optionBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      setOption(btn.dataset.group, btn.dataset.value, false);
    });
  });

  updateSummary();
}

/**
 * Text-to-Speech: Read out "Please enter [field name]"
 */
export function setupTextToSpeech(getCurrentField) {
  const listenBtn = document.getElementById("listenBtn");
  const listenBtnText = document.getElementById("listenBtnText");
  if (!listenBtn || !listenBtnText) return;

  if (!("speechSynthesis" in window)) {
    console.log("Text-to-speech not supported");
    return;
  }

  listenBtn.addEventListener("click", () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      listenBtnText.textContent = "Listen";
      listenBtn.style.background = "#fff";
      isSpeaking = false;
      return;
    }

    const field = getCurrentField ? getCurrentField() : null;
    if (!field) return;
    const textToSpeak = "Please enter " + field.name + ".";

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      isSpeaking = true;
      listenBtnText.textContent = "Playing...";
      listenBtn.style.background = "var(--blush-deep)";
    };

    utterance.onend = () => {
      isSpeaking = false;
      listenBtnText.textContent = "Listen";
      listenBtn.style.background = "#fff";
    };

    utterance.onerror = (event) => {
      isSpeaking = false;
      listenBtnText.textContent = "Listen";
      listenBtn.style.background = "#fff";
      console.error("Speech synthesis error:", event.error);
    };

    window.speechSynthesis.speak(utterance);
  });
}

/**
 * Speak arbitrary text via TTS (used when entering a step if field modality is 'spoken').
 */
export function speakPrompt(text) {
  if (!("speechSynthesis" in window) || !text) return;
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 1;
  window.speechSynthesis.speak(utterance);
}

/**
 * Speech Recognition: Capture spoken answers with voice commands
 */
export function setupSpeechRecognition(onNextCommand, onFinishCommand, onTranscript) {
  const speakBtn = document.getElementById("speakBtn");
  const speakBtnText = document.getElementById("speakBtnText");
  const speakStatus = document.getElementById("speakStatus");
  const fillResponseInput = document.getElementById("fillResponseInput");
  const fillNextBtn = document.getElementById("fillNextBtn");

  if (!speakBtn || !speakBtnText || !speakStatus) return;

  if (
    !("webkitSpeechRecognition" in window) &&
    !("SpeechRecognition" in window)
  ) {
    speakStatus.textContent = "Speech recognition not supported in this browser.";
    speakBtn.disabled = true;
    return;
  }

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();

  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onstart = () => {
    isListening = true;
    speakBtnText.textContent = "Listening...";
    speakBtn.style.background = "var(--plum-light)";
    speakBtn.style.borderColor = "var(--plum)";
    speakStatus.textContent = "Listening... Speak now.";
  };

  recognition.onresult = (event) => {
    let transcript = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    const cleaned = transcript.trim();
    const lower = cleaned.toLowerCase().replace(/[.!?,;]+$/g, "").trim();

    // Voice commands: "next" advances, "finish"/"submit"/"done" finishes
    if (
      lower === "next" ||
      lower === "go next" ||
      lower === "next field"
    ) {
      speakStatus.textContent = '➡️ Heard "next" — moving on...';
      try {
        recognition.stop();
      } catch (e) {}
      setTimeout(() => {
        if (onNextCommand) onNextCommand();
        else if (fillNextBtn) fillNextBtn.click();
      }, 150);
      return;
    }

    if (
      lower === "finish" ||
      lower === "submit" ||
      lower === "done" ||
      lower === "save" ||
      lower === "finished"
    ) {
      speakStatus.textContent = '✅ Heard "' + lower + '" — finishing form...';
      try {
        recognition.stop();
      } catch (e) {}
      setTimeout(() => {
        if (onFinishCommand) onFinishCommand();
        else if (fillNextBtn) fillNextBtn.click();
      }, 150);
      return;
    }

    // Strip trailing "next"/"finish" so answer + command in one breath still works
    const m = lower.match(/^(.*?)[\s,]+(next|finish|submit|done)$/);
    if (m && m[1]) {
      const val = cleaned.substring(0, m[1].length).trim();
      if (fillResponseInput) fillResponseInput.value = val;
      if (onTranscript) onTranscript(val);
      speakStatus.textContent = 'Heard: "' + val + '" — ' + m[2];
      try {
        recognition.stop();
      } catch (e) {}
      setTimeout(() => {
        if (m[2] === "next") {
          if (onNextCommand) onNextCommand();
          else if (fillNextBtn) fillNextBtn.click();
        } else {
          if (onFinishCommand) onFinishCommand();
          else if (fillNextBtn) fillNextBtn.click();
        }
      }, 200);
      return;
    }

    if (fillResponseInput) fillResponseInput.value = cleaned;
    if (onTranscript) onTranscript(cleaned);
    speakStatus.textContent = 'Heard: "' + cleaned + '"  (say "next" or "finish")';
  };

  recognition.onerror = (event) => {
    isListening = false;
    speakBtnText.textContent = "Speak";
    speakBtn.style.background = "#fff";
    speakStatus.textContent = "Error: " + event.error + ". Please try again.";
  };

  recognition.onend = () => {
    isListening = false;
    speakBtnText.textContent = "Speak";
    speakBtn.style.background = "#fff";
    speakStatus.textContent = "Speech recognition ended.";
  };

  speakBtn.addEventListener("click", () => {
    if (isListening) {
      recognition.stop();
    } else {
      if (fillResponseInput) fillResponseInput.value = "";
      recognition.start();
    }
  });
}
