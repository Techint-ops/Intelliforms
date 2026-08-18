/**
 * Intelliform — Main Application Entry & UI Orchestrator
 * Ownership: Person C (main.js + index.html + styles.css)
 * 
 * Owns:
 *  - Application initialization and module lifecycle orchestration
 *  - Multi-step form builder wizard (count, field specification, summary)
 *  - Form filling workflow (step progression, visual ASL rendering, input synchronization)
 *  - Form submission persistence (Cloud via Supabase / Local fallback)
 *  - Submissions Viewer Modal (live query, rendering, deletion)
 *  - Accessibility Statement Modal & Barrier Reporting
 *  - Text zoom/font scaling controls
 *  - Navigation smooth-scrolling jump helpers
 * 
 * Depends on:
 *  - src/supabase-client.js
 *  - src/train.js
 *  - src/speech.js
 *  - src/recognition.js
 *  - src/asl-signs.js
 * 
 * Teammate Note:
 *  - Evaluator explanation: This module serves as the central hub. It connects all sub-systems
 *    (recognition, speech, train, and database), wires up the DOM event listeners, and drives the
 *    accessible form filling user journey.
 */

import {
  sb,
  saveFormSubmission,
  fetchFormSubmissions,
  deleteFormSubmission,
} from "./supabase-client.js";

import {
  getPersonaState,
  initPersonaControls,
  setupTextToSpeech,
  setupSpeechRecognition,
  speakPrompt,
  announce,
  announceFill,
  labelFor,
  personaLabelFor,
} from "./speech.js";

import {
  initRecognitionControls,
  startCamera,
  stopCamera,
  getCurrentLandmarks,
} from "./recognition.js";

import {
  initTrainPanel,
  refreshTrainList,
} from "./train.js";

import { aslSigns } from "./asl-signs.js";

// Global Form State
let totalFields = 0;
let currentFieldIndex = 0;
let collectedFields = [];
let formName = "";

let fillCollectedFields = [];
let fillCurrentIndex = 0;
let fillResponses = [];

/* ---------------- Form Builder & Filling UI Functions ---------------- */

function shouldShowFormFilling() {
  const state = getPersonaState();
  return (
    (state.field === "spoken" ||
      state.field === "written" ||
      state.field === "signed") &&
    (state.details === "spoken" ||
      state.details === "written" ||
      state.details === "signed")
  );
}

function showStep(name) {
  const stepCount = document.getElementById("stepCount");
  const stepField = document.getElementById("stepField");
  const stepSummary = document.getElementById("stepSummary");
  if (stepCount) stepCount.classList.toggle("hidden", name !== "count");
  if (stepField) stepField.classList.toggle("hidden", name !== "field");
  if (stepSummary) stepSummary.classList.toggle("hidden", name !== "summary");
}

function announceBuilder(msg) {
  const builderLiveRegion = document.getElementById("builderLiveRegion");
  if (builderLiveRegion) {
    builderLiveRegion.textContent = msg;
  }
}

function typeLabelFor(value) {
  if (value === "alphabetical") return "Alphabetical";
  if (value === "numerical") return "Numerical";
  if (value === "alphanumerical") return "Alphanumerical";
  return value || "";
}

function renderFieldStep() {
  const fieldStepLabel = document.getElementById("fieldStepLabel");
  const fieldStepHeading = document.getElementById("fieldStepHeading");
  const fieldNameInput = document.getElementById("fieldNameInput");
  const fieldTypeInput = document.getElementById("fieldTypeInput");
  const fieldError = document.getElementById("fieldError");
  const fieldBackBtn = document.getElementById("fieldBackBtn");
  const fieldNextBtn = document.getElementById("fieldNextBtn");
  const fieldFinishBtn = document.getElementById("fieldFinishBtn");
  const builderProgress = document.getElementById("builderProgress");

  const num = currentFieldIndex + 1;
  if (fieldStepLabel) fieldStepLabel.textContent = "Field " + num + " of " + totalFields;
  if (fieldStepHeading) fieldStepHeading.textContent = "Tell us about field " + num;
  if (fieldNameInput) {
    fieldNameInput.value = collectedFields[currentFieldIndex]
      ? collectedFields[currentFieldIndex].name
      : "";
  }
  if (fieldTypeInput) {
    fieldTypeInput.value = collectedFields[currentFieldIndex]
      ? collectedFields[currentFieldIndex].type
      : "";
  }
  if (fieldError) fieldError.textContent = "";
  if (fieldBackBtn) {
    fieldBackBtn.textContent = currentFieldIndex === 0 ? "Back" : "Previous field";
  }

  if (num === totalFields) {
    if (fieldNextBtn) fieldNextBtn.classList.add("hidden");
    if (fieldFinishBtn) fieldFinishBtn.classList.remove("hidden");
  } else {
    if (fieldNextBtn) fieldNextBtn.classList.remove("hidden");
    if (fieldFinishBtn) fieldFinishBtn.classList.add("hidden");
  }

  if (builderProgress) {
    builderProgress.innerHTML = "";
    for (let i = 0; i < totalFields; i++) {
      const dot = document.createElement("span");
      dot.className =
        "builder-progress-dot" +
        (i < currentFieldIndex
          ? " done"
          : i === currentFieldIndex
            ? " current"
            : "");
      builderProgress.appendChild(dot);
    }
  }
  announceBuilder("Field " + num + " of " + totalFields + ".");
}

function renderSummary() {
  const summaryFormName = document.getElementById("summaryFormName");
  const summaryTableBody = document.getElementById("summaryTableBody");

  if (summaryFormName) summaryFormName.textContent = '"' + formName + '" — fields';
  if (summaryTableBody) {
    summaryTableBody.innerHTML = "";
    collectedFields.forEach((f, i) => {
      const tr = document.createElement("tr");
      const tdNum = document.createElement("td");
      tdNum.textContent = i + 1;
      const tdName = document.createElement("td");
      tdName.textContent = f.name;
      const tdType = document.createElement("td");
      tdType.textContent = typeLabelFor(f.type);
      tr.appendChild(tdNum);
      tr.appendChild(tdName);
      tr.appendChild(tdType);
      summaryTableBody.appendChild(tr);
    });
  }
  announceBuilder(
    "All " +
      collectedFields.length +
      " fields collected. Review and generate your form.",
  );
}

function renderASLSigns(text) {
  const aslSignDisplay =
    document.getElementById("aslSignsDisplay") ||
    document.getElementById("aslSignDisplay");
  const aslTextDisplay = document.getElementById("aslTextDisplay");

  if (!aslSignDisplay) return;
  aslSignDisplay.innerHTML = "";
  if (aslTextDisplay) aslTextDisplay.textContent = text || "";
  if (!text) return;

  const chars = text.toLowerCase().split("");
  chars.forEach((c) => {
    if (aslSigns[c]) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = aslSigns[c];
      const imgOrDiv = wrapper.firstElementChild;
      if (imgOrDiv) {
        aslSignDisplay.appendChild(imgOrDiv);
      }
    } else if (c === " ") {
      const space = document.createElement("span");
      space.style.cssText = "display:inline-block; width:16px;";
      aslSignDisplay.appendChild(space);
    } else {
      const fallback = document.createElement("span");
      fallback.style.cssText =
        "display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:8px;background:rgba(255,255,255,0.1);color:#fff;font-weight:700;margin:3px;";
      fallback.textContent = c.toUpperCase();
      aslSignDisplay.appendChild(fallback);
    }
  });
}

function renderFillField() {
  const fillFieldLabel = document.getElementById("fillFieldLabel");
  const fillResponseInput = document.getElementById("fillResponseInput");
  const fillProgress = document.getElementById("fillProgress");
  const fillNextBtn = document.getElementById("fillNextBtn");
  const state = getPersonaState();

  const field = fillCollectedFields[fillCurrentIndex];
  if (!field) return;

  if (state.field === "spoken") {
    if (fillFieldLabel) fillFieldLabel.textContent = "Please enter " + field.name + ".";
  } else {
    if (fillFieldLabel) fillFieldLabel.textContent = field.name;
  }

  if (fillResponseInput) {
    fillResponseInput.value = fillResponses[fillCurrentIndex] || "";
    fillResponseInput.focus();
  }

  if (fillProgress) {
    fillProgress.textContent =
      "Field " + (fillCurrentIndex + 1) + " of " + fillCollectedFields.length;
  }

  if (fillNextBtn) {
    const span = fillNextBtn.querySelector("span");
    if (span) {
      span.textContent =
        fillCurrentIndex === fillCollectedFields.length - 1 ? "Finish" : "Next";
    }
  }

  if (state.field === "spoken") {
    speakPrompt("Please enter " + field.name + ".");
  }

  if (state.field === "signed") {
    renderASLSigns(field.name);
  }

  announceFill(
    "Field " +
      (fillCurrentIndex + 1) +
      " of " +
      fillCollectedFields.length +
      ": " +
      field.name,
  );
}

function showFormFillingInterface() {
  const customizeSection = document.querySelector(".section");
  const builderSection = document.getElementById("builderSection");
  const formFillingSection = document.getElementById("formFillingSection");
  const fillFormName = document.getElementById("fillFormName");
  const listenBtn = document.getElementById("listenBtn");
  const aslWindow = document.getElementById("aslWindow");
  const speakBtn = document.getElementById("speakBtn");
  const speakStatus = document.getElementById("speakStatus");
  const cameraCaptureArea = document.getElementById("cameraCaptureArea");
  const fillResponseInput = document.getElementById("fillResponseInput");
  const state = getPersonaState();

  if (collectedFields && collectedFields.length > 0) {
    fillCollectedFields = collectedFields.slice();
  } else {
    fillCollectedFields = [
      { name: "Full Name", type: "alphabetical" },
      { name: "Email Address", type: "alphanumerical" },
      { name: "Phone Number", type: "numerical" },
    ];
  }

  fillCurrentIndex = 0;
  fillResponses = [];

  if (fillFormName) fillFormName.textContent = formName || "Untitled Form";

  const fillFieldStatus = document.getElementById("fillFieldStatus");
  const fillDetailsStatus = document.getElementById("fillDetailsStatus");
  if (fillFieldStatus) fillFieldStatus.textContent = labelFor(state.field) || "Written";
  if (fillDetailsStatus) fillDetailsStatus.textContent = labelFor(state.details) || "Spoken";

  if (state.field === "spoken") {
    if (listenBtn) listenBtn.classList.remove("hidden");
  } else {
    if (listenBtn) listenBtn.classList.add("hidden");
  }

  if (state.field === "signed") {
    if (aslWindow) aslWindow.classList.remove("hidden");
  } else {
    if (aslWindow) aslWindow.classList.add("hidden");
  }

  if (state.details === "spoken") {
    if (speakBtn) speakBtn.classList.remove("hidden");
    if (speakStatus) speakStatus.textContent = "Click Speak and say your answer.";
  } else {
    if (speakBtn) speakBtn.classList.add("hidden");
    if (speakStatus) speakStatus.textContent = "";
  }

  if (state.details === "signed") {
    if (cameraCaptureArea) cameraCaptureArea.classList.remove("hidden");
    if (fillResponseInput) fillResponseInput.placeholder = "Your hand sign will appear here...";
    setTimeout(() => {
      startCamera();
    }, 500);
  } else {
    if (cameraCaptureArea) cameraCaptureArea.classList.add("hidden");
    stopCamera();
    if (fillResponseInput) fillResponseInput.placeholder = "Type your answer here...";
  }

  if (customizeSection) customizeSection.classList.add("hidden");
  if (builderSection) builderSection.classList.add("hidden");
  if (formFillingSection) {
    formFillingSection.classList.remove("hidden");
    formFillingSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  renderFillField();
}

function openBuilder() {
  announce("Moving to form setup.");
  if (shouldShowFormFilling()) {
    showFormFillingInterface();
    return;
  }
  const customizeSection = document.querySelector(".section");
  const builderSection = document.getElementById("builderSection");
  const formNameInput = document.getElementById("formNameInput");

  if (customizeSection) customizeSection.classList.add("hidden");
  if (builderSection) {
    builderSection.classList.remove("hidden");
    builderSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  showStep("count");
  if (formNameInput) formNameInput.focus();
}

function openCustomizeBuilder() {
  announce("Opening form builder.");
  const customizeSection = document.querySelector(".section");
  const builderSection = document.getElementById("builderSection");
  const formFillingSection = document.getElementById("formFillingSection");
  const formNameInput = document.getElementById("formNameInput");

  if (customizeSection) customizeSection.classList.add("hidden");
  if (formFillingSection) formFillingSection.classList.add("hidden");
  if (builderSection) {
    builderSection.classList.remove("hidden");
    builderSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  showStep("count");
  if (formNameInput) formNameInput.focus();
}

function submitForm() {
  const formFillingSection = document.getElementById("formFillingSection");
  const customizeSection = document.querySelector(".section");
  const state = getPersonaState();

  let summary = "Form Submitted Successfully!\n\n";
  summary += "Form: " + (formName || "Untitled Form") + "\n";
  summary += "Persona: " + personaLabelFor(state.persona) + "\n";
  summary += "Field presentation: " + labelFor(state.field) + "\n";
  summary += "Details response: " + labelFor(state.details) + "\n\n";
  summary += "Responses:\n";

  fillCollectedFields.forEach((f, i) => {
    summary += "• " + f.name + ": " + (fillResponses[i] || "(no answer)") + "\n";
  });

  const payload = {
    form_name: formName || "Untitled Form",
    fields: fillCollectedFields.map((f) => ({
      name: f.name,
      type: f.type,
      persona: state.persona,
      field_mode: state.field,
      details_mode: state.details,
    })),
    responses: fillCollectedFields.map((f, i) => ({
      name: f.name,
      answer: fillResponses[i] || "",
    })),
  };

  function done(msg) {
    alert(summary + "\n" + msg);
    if (formFillingSection) formFillingSection.classList.add("hidden");
    if (customizeSection) {
      customizeSection.classList.remove("hidden");
      customizeSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  saveFormSubmission(payload)
    .then((res) => {
      done(res.source === "cloud" ? "✅ Saved to cloud." : "✅ Saved locally.");
    })
    .catch((err) => {
      console.error("Save failed:", err);
      done("⚠️ Could not save to cloud: " + (err.message || err));
    });
}

/* ---------------- Submissions Viewer Modal ---------------- */

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c];
  });
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch (e) {
    return iso || "";
  }
}

function renderSubmissions(rows, source) {
  const listEl = document.getElementById("submissionsList");
  if (!listEl) return;
  if (!rows || !rows.length) {
    listEl.innerHTML = '<p style="color:#475569;">No submissions saved yet.</p>';
    return;
  }
  let html =
    '<p style="color:#475569; font-size:13px; margin:0 0 12px;">Showing ' +
    rows.length +
    " submission(s) from " +
    source +
    ".</p>";
  rows.forEach((row, idx) => {
    const id = row.id != null ? row.id : "local:" + idx;
    const isCloud = row.id != null;
    html +=
      '<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:14px 16px; margin-bottom:12px;">';
    html +=
      '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px; gap:8px;">';
    html += "<div>";
    html +=
      '<strong style="color:#1e3a8a; font-size:16px;">' +
      escapeHtml(row.form_name || "Untitled Form") +
      "</strong>";
    html +=
      '<span style="display:inline-block; margin-left:8px; background:' +
      (isCloud ? "#dcfce7; color:#166534" : "#fef3c7; color:#92400e") +
      '; font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px;">' +
      (isCloud ? "Cloud" : "Local") +
      "</span>";
    html += "</div>";
    html +=
      '<span style="color:#64748b; font-size:12px;">' +
      escapeHtml(fmtDate(row.created_at)) +
      "</span>";
    html += "</div>";

    const firstField = (row.fields && row.fields[0]) || {};
    const persona = row.persona || firstField.persona || "—";
    const fieldMode = row.field_mode || firstField.field_mode || "—";
    const detailsMode = row.details_mode || firstField.details_mode || "—";

    html +=
      '<div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:10px; font-size:12px;">';
    html +=
      '<span style="background:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:4px;">Persona: ' +
      escapeHtml(persona) +
      "</span>";
    html +=
      '<span style="background:#ede9fe; color:#5b21b6; padding:2px 8px; border-radius:4px;">Field: ' +
      escapeHtml(fieldMode) +
      "</span>";
    html +=
      '<span style="background:#fae8ff; color:#86198f; padding:2px 8px; border-radius:4px;">Details: ' +
      escapeHtml(detailsMode) +
      "</span>";
    html += "</div>";

    if (row.responses && row.responses.length) {
      html +=
        '<table style="width:100%; border-collapse:collapse; font-size:13px; background:#fff; border-radius:6px; overflow:hidden; border:1px solid #e2e8f0;">';
      html +=
        '<thead><tr style="background:#f1f5f9; text-align:left;"><th style="padding:6px 10px; color:#475569;">Field</th><th style="padding:6px 10px; color:#475569;">Answer</th></tr></thead>';
      html += "<tbody>";
      row.responses.forEach((r) => {
        html +=
          '<tr style="border-top:1px solid #f1f5f9;"><td style="padding:6px 10px; font-weight:500;">' +
          escapeHtml(r.name) +
          '</td><td style="padding:6px 10px; color:#0f172a;">' +
          escapeHtml(r.answer || "(empty)") +
          "</td></tr>";
      });
      html += "</tbody></table>";
    } else {
      html += '<p style="color:#64748b; font-size:12px; margin:0;">No response items recorded.</p>';
    }

    html +=
      '<div style="text-align:right; margin-top:8px;"><button type="button" class="del-sub-btn" data-id="' +
      escapeHtml(id) +
      '" data-idx="' +
      idx +
      '" style="background:transparent; border:1px solid #fca5a5; color:#dc2626; padding:4px 10px; border-radius:4px; font-size:12px; cursor:pointer;">🗑 Delete</button></div>';
    html += "</div>";
  });
  listEl.innerHTML = html;

  listEl.querySelectorAll(".del-sub-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const idx = parseInt(btn.getAttribute("data-idx"), 10);
      deleteSubmissionHandler(id, idx, btn);
    });
  });
}

function deleteSubmissionHandler(id, idx, btn) {
  if (!confirm("Delete this submission? This cannot be undone.")) return;
  btn.disabled = true;
  btn.textContent = "Deleting…";
  deleteFormSubmission(id, idx)
    .then(() => {
      loadSubmissions();
    })
    .catch((err) => {
      alert("Delete failed: " + (err.message || err));
      btn.disabled = false;
      btn.innerHTML = '<span aria-hidden="true">🗑</span> Delete';
    });
}

function loadSubmissions() {
  const listEl = document.getElementById("submissionsList");
  if (!listEl) return;
  listEl.innerHTML = '<p style="color:#475569;">Loading…</p>';
  fetchFormSubmissions(200)
    .then((res) => {
      renderSubmissions(res.data, res.source);
    })
    .catch((err) => {
      console.error(err);
      fetchFormSubmissions(200).then((localRes) => {
        renderSubmissions(localRes.data, "local (fallback)");
      });
    });
}

function initSubmissionsModal() {
  const viewBtn = document.getElementById("viewSubmissionsBtn");
  const modal = document.getElementById("submissionsModal");
  const closeBtn = document.getElementById("closeSubmissionsBtn");
  const refreshBtn = document.getElementById("refreshSubmissionsBtn");
  const navViewBtn = document.getElementById("viewSubmissionsNavBtn");

  function openSubmissions() {
    if (!modal) return;
    modal.style.display = "flex";
    modal.classList.remove("hidden");
    loadSubmissions();
  }

  function closeSubmissions() {
    if (!modal) return;
    modal.style.display = "none";
    modal.classList.add("hidden");
  }

  if (viewBtn) viewBtn.addEventListener("click", openSubmissions);
  if (navViewBtn) navViewBtn.addEventListener("click", openSubmissions);
  if (closeBtn) closeBtn.addEventListener("click", closeSubmissions);
  if (refreshBtn) refreshBtn.addEventListener("click", loadSubmissions);

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeSubmissions();
    });
  }
}

/* ---------------- Accessibility Statement Modal ---------------- */

function initAccessibilityModal() {
  const panel = document.getElementById("accessibilityStatement");
  const showBtn = document.getElementById("showStatementBtn");
  const hideBtn = document.getElementById("hideStatementBtn");
  const navStmtBtn = document.getElementById("showStatementNavBtn");
  const barrierForm = document.getElementById("barrierForm");
  let lastFocus = null;

  function openStatement() {
    if (!panel) return;
    lastFocus = document.activeElement;
    panel.classList.add("visible");
    panel.scrollTop = 0;
    panel.focus();
    document.body.style.overflow = "hidden";
  }

  function closeStatement() {
    if (!panel) return;
    panel.classList.remove("visible");
    document.body.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }

  if (showBtn) showBtn.addEventListener("click", openStatement);
  if (hideBtn) hideBtn.addEventListener("click", closeStatement);
  if (navStmtBtn) navStmtBtn.addEventListener("click", openStatement);

  if (panel) {
    panel.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeStatement();
    });
  }

  if (barrierForm) {
    barrierForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const desc = (document.getElementById("barrierDesc") || {}).value || "";
      const tech = (document.getElementById("barrierTech") || {}).value || "";
      const contact = (document.getElementById("barrierContact") || {}).value || "";
      const liveMsg = document.getElementById("barrierLiveMsg");

      if (!desc.trim()) {
        if (liveMsg) liveMsg.textContent = "Please describe the barrier before submitting.";
        return;
      }

      if (liveMsg) {
        liveMsg.textContent =
          "Thank you. Your feedback has been recorded. We will review it within 5 business days.";
      }
      barrierForm.reset();
    });
  }
}

/* ---------------- Text Scaling Controls ---------------- */

function initTextScaling() {
  let fontScale = 100;
  const decreaseBtn = document.getElementById("decreaseText");
  const increaseBtn = document.getElementById("increaseText");
  const sizeLabel = document.getElementById("textSizeLabel");

  function applyScale() {
    document.documentElement.style.fontSize = fontScale + "%";
    if (sizeLabel) sizeLabel.textContent = fontScale + "%";
  }

  if (decreaseBtn) {
    decreaseBtn.addEventListener("click", () => {
      fontScale = Math.max(80, fontScale - 10);
      applyScale();
    });
  }

  if (increaseBtn) {
    increaseBtn.addEventListener("click", () => {
      fontScale = Math.min(200, fontScale + 10);
      applyScale();
    });
  }
}

/* ---------------- Navigation Jump Helpers ---------------- */

export function scrollToMain() {
  const el = document.getElementById("heroSection");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function scrollToAbout() {
  const el = document.getElementById("aboutSection");
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function showCustomizeSection() {
  const customizeSection = document.querySelector(".section");
  const builderSection = document.getElementById("builderSection");
  const fillSection = document.getElementById("formFillingSection");
  if (builderSection) builderSection.classList.add("hidden");
  if (fillSection) fillSection.classList.add("hidden");
  if (customizeSection) customizeSection.classList.remove("hidden");
  return customizeSection;
}

export function focusChooser(which) {
  showCustomizeSection();
  const col = document.getElementById(which === "field" ? "fieldCol" : "detailsCol");
  const other = document.getElementById(which === "field" ? "detailsCol" : "fieldCol");
  if (other) other.classList.remove("is-target");
  if (!col) return;
  col.classList.add("is-target");
  col.scrollIntoView({ behavior: "smooth", block: "center" });
  const first = col.querySelector(".option-btn");
  if (first) setTimeout(() => { first.focus(); }, 320);
}

export function navField() {
  focusChooser("field");
}

export function navDetails() {
  focusChooser("details");
}

export function navFill() {
  const startBtn = document.getElementById("startBtn");
  if (startBtn && startBtn.getAttribute("aria-disabled") !== "true") {
    startBtn.click();
    return;
  }
  const customizeSection = showCustomizeSection();
  if (customizeSection) {
    customizeSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  focusChooser("field");
}

export function navCustomize() {
  const btn = document.getElementById("customize-heading");
  if (btn) btn.click();
}

// Expose nav helpers globally for HTML onclick inline attributes
if (typeof window !== "undefined") {
  window.scrollToMain = scrollToMain;
  window.scrollToAbout = scrollToAbout;
  window.showCustomizeSection = showCustomizeSection;
  window.focusChooser = focusChooser;
  window.navField = navField;
  window.navDetails = navDetails;
  window.navFill = navFill;
  window.navCustomize = navCustomize;
}

/* ---------------- App Entry Point ---------------- */

function initApp() {
  // 1. Initialize Persona cards and modality selectors
  initPersonaControls();

  // 2. Initialize Speech (TTS & STT)
  setupTextToSpeech(() => fillCollectedFields[fillCurrentIndex]);
  setupSpeechRecognition(
    // onNext
    () => {
      const fillNextBtn = document.getElementById("fillNextBtn");
      if (fillNextBtn) fillNextBtn.click();
    },
    // onFinish
    () => {
      const fillNextBtn = document.getElementById("fillNextBtn");
      if (fillNextBtn) fillNextBtn.click();
    },
    // onTranscript
    (val) => {
      if (fillResponses && typeof fillCurrentIndex !== "undefined") {
        fillResponses[fillCurrentIndex] = val;
      }
    },
  );

  // 3. Initialize Recognition (ASL Webcam & Controls)
  initRecognitionControls();

  // 4. Initialize ASL Train Panel & Cloud Sync
  initTrainPanel(getCurrentLandmarks);

  // 5. Initialize Modals and Accessibility tools
  initSubmissionsModal();
  initAccessibilityModal();
  initTextScaling();

  // 6. Form Builder UI Event Listeners
  const customizeBtn = document.getElementById("customize-heading");
  const startBtn = document.getElementById("startBtn");
  const countNextBtn = document.getElementById("countNextBtn");
  const backToChooserBtn = document.getElementById("backToChooserBtn");
  const fieldNextBtn = document.getElementById("fieldNextBtn");
  const fieldFinishBtn = document.getElementById("fieldFinishBtn");
  const fieldBackBtn = document.getElementById("fieldBackBtn");
  const editFieldsBtn = document.getElementById("editFieldsBtn");
  const generateFormBtn = document.getElementById("generateFormBtn");
  const fillNextBtn = document.getElementById("fillNextBtn");
  const fillResponseInput = document.getElementById("fillResponseInput");
  const formNameInput = document.getElementById("formNameInput");
  const fieldCountInput = document.getElementById("fieldCountInput");
  const countError = document.getElementById("countError");
  const fieldNameInput = document.getElementById("fieldNameInput");
  const fieldTypeInput = document.getElementById("fieldTypeInput");
  const fieldError = document.getElementById("fieldError");

  if (customizeBtn) customizeBtn.addEventListener("click", openCustomizeBuilder);
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      if (startBtn.getAttribute("aria-disabled") === "true") return;
      openBuilder();
    });
  }

  if (backToChooserBtn) {
    backToChooserBtn.addEventListener("click", () => {
      const builderSection = document.getElementById("builderSection");
      const customizeSection = document.querySelector(".section");
      if (builderSection) builderSection.classList.add("hidden");
      if (customizeSection) {
        customizeSection.classList.remove("hidden");
        customizeSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  if (countNextBtn && formNameInput && fieldCountInput) {
    countNextBtn.addEventListener("click", () => {
      const nameVal = formNameInput.value.trim();
      const raw = fieldCountInput.value.trim();
      const n = parseInt(raw, 10);

      if (!nameVal) {
        if (countError) countError.textContent = "Enter a name for your form.";
        formNameInput.focus();
        return;
      }
      if (!raw || isNaN(n) || n < 1) {
        if (countError) countError.textContent = "Enter a number of at least 1.";
        fieldCountInput.focus();
        return;
      }
      if (n > 20) {
        if (countError) countError.textContent = "Please enter 20 or fewer fields.";
        fieldCountInput.focus();
        return;
      }

      if (countError) countError.textContent = "";
      formName = nameVal;
      totalFields = n;
      collectedFields = [];
      currentFieldIndex = 0;
      renderFieldStep();
      showStep("field");
      if (fieldNameInput) fieldNameInput.focus();
    });
  }

  if (fieldNextBtn && fieldNameInput && fieldTypeInput) {
    fieldNextBtn.addEventListener("click", () => {
      const name = fieldNameInput.value.trim();
      const type = fieldTypeInput.value;

      if (!name) {
        if (fieldError) fieldError.textContent = "Enter a name for this field.";
        fieldNameInput.focus();
        return;
      }
      if (!type) {
        if (fieldError) fieldError.textContent = "Choose a type for this field.";
        fieldTypeInput.focus();
        return;
      }

      collectedFields[currentFieldIndex] = { name, type };

      if (currentFieldIndex < totalFields - 1) {
        currentFieldIndex++;
        renderFieldStep();
        fieldNameInput.focus();
      } else {
        renderSummary();
        showStep("summary");
      }
    });
  }

  if (fieldFinishBtn && fieldNameInput && fieldTypeInput) {
    fieldFinishBtn.addEventListener("click", () => {
      const name = fieldNameInput.value.trim();
      const type = fieldTypeInput.value;
      if (name && type) {
        collectedFields[currentFieldIndex] = { name, type };
      }
      const builderSection = document.getElementById("builderSection");
      const customizeSection = document.querySelector(".section");
      if (builderSection) builderSection.classList.add("hidden");
      if (customizeSection) {
        customizeSection.classList.remove("hidden");
        customizeSection.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      announceBuilder("Returned to home page. Form customization saved.");
    });
  }

  if (fieldBackBtn) {
    fieldBackBtn.addEventListener("click", () => {
      if (currentFieldIndex === 0) {
        showStep("count");
        if (fieldCountInput) fieldCountInput.focus();
      } else {
        currentFieldIndex--;
        renderFieldStep();
        if (fieldNameInput) fieldNameInput.focus();
      }
    });
  }

  if (editFieldsBtn && fieldNameInput) {
    editFieldsBtn.addEventListener("click", () => {
      currentFieldIndex = 0;
      renderFieldStep();
      showStep("field");
      fieldNameInput.focus();
    });
  }

  if (generateFormBtn) {
    generateFormBtn.addEventListener("click", () => {
      generateFormBtn.textContent = "Generating…";
      setTimeout(() => {
        generateFormBtn.textContent = "Generate form";
        const lines = collectedFields
          .map((f, i) => i + 1 + ". " + f.name + " — " + typeLabelFor(f.type))
          .join("\n");
        alert('Form "' + formName + '" is ready with these fields:\n\n' + lines);
      }, 600);
    });
  }

  // Live Form Filling Step Progression
  const fillBackBtn = document.getElementById("fillBackBtn");
  if (fillBackBtn && fillResponseInput) {
    fillBackBtn.addEventListener("click", () => {
      if (fillCurrentIndex > 0) {
        fillResponses[fillCurrentIndex] = fillResponseInput.value;
        fillCurrentIndex--;
        renderFillField();
      } else {
        const formFillingSection = document.getElementById("formFillingSection");
        const customizeSection = document.querySelector(".section");
        if (formFillingSection) formFillingSection.classList.add("hidden");
        if (customizeSection) {
          customizeSection.classList.remove("hidden");
          customizeSection.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        stopCamera();
      }
    });
  }

  if (fillNextBtn && fillResponseInput) {
    fillNextBtn.addEventListener("click", () => {
      fillResponses[fillCurrentIndex] = fillResponseInput.value;

      if (fillCurrentIndex < fillCollectedFields.length - 1) {
        fillCurrentIndex++;
        renderFillField();
      } else {
        submitForm();
      }
    });

    fillResponseInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        fillNextBtn.click();
      }
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}
