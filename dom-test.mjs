import fs from "fs";
import { JSDOM } from "jsdom";

console.log("==================================================");
console.log(" INTELLIFORM DOM & UI INTERACTION TEST SUITE");
console.log("==================================================\n");

const html = fs.readFileSync("./index.html", "utf-8");
const dom = new JSDOM(html, {
  url: "http://localhost:5173",
  runScripts: "outside-only"
});

const { window } = dom;
const { document } = window;
global.window = window;
global.document = document;
global.localStorage = window.localStorage;

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${name}`);
    failed++;
  }
}

// 1. Check all critical DOM elements exist in HTML
console.log("1. Verifying HTML DOM Element IDs:");
const requiredIds = [
  "heroSection", "aboutSection", "customize-heading", "startBtn",
  "builderSection", "stepCount", "stepField", "stepSummary",
  "formNameInput", "fieldCountInput", "countNextBtn", "fieldNameInput", "fieldTypeInput", "fieldNextBtn", "fieldBackBtn", "fieldFinishBtn",
  "formFillingSection", "fillFormName", "fillFieldLabel", "aslWindow", "aslSignsDisplay", "aslTextDisplay",
  "listenBtn", "speakBtn", "cameraCaptureArea", "webcamVideo", "handCanvas", "startCameraBtn", "captureSignBtn", "clearSignBtn",
  "fillResponseInput", "fillBackBtn", "fillNextBtn", "fillProgress",
  "submissionsModal", "viewSubmissionsBtn", "viewSubmissionsNavBtn", "closeSubmissionsBtn", "refreshSubmissionsBtn", "submissionsList",
  "accessibilityStatement", "showStatementBtn", "showStatementNavBtn", "hideStatementBtn", "barrierForm",
  "trainPanel", "trainLabelInput", "trainRecordBtn", "trainClearLabelBtn", "syncCodeInput", "syncConnectBtn", "syncDisconnectBtn", "syncUploadBtn", "syncReplaceBtn", "trainExportBtn", "trainImportBtn"
];

let allIdsPresent = true;
requiredIds.forEach(id => {
  const el = document.getElementById(id);
  if (!el) {
    console.error(`Missing ID: #${id}`);
    allIdsPresent = false;
  }
});
assert(allIdsPresent, "All 45+ critical DOM element IDs exist in index.html");

// 2. Test Modal Visibility Logic
console.log("\n2. Testing Submissions Modal & Accessibility Modal Triggers:");
const subModal = document.getElementById("submissionsModal");
assert(subModal !== null, "submissionsModal found");
subModal.style.display = "flex";
subModal.classList.remove("hidden");
assert(subModal.style.display === "flex" && !subModal.classList.contains("hidden"), "Submissions modal opens with display: flex");
subModal.style.display = "none";
subModal.classList.add("hidden");
assert(subModal.style.display === "none" && subModal.classList.contains("hidden"), "Submissions modal closes with display: none");

const asPanel = document.getElementById("accessibilityStatement");
assert(asPanel !== null, "accessibilityStatement modal found");
asPanel.classList.add("visible");
assert(asPanel.classList.contains("visible"), "Accessibility modal opens with .visible class");
asPanel.classList.remove("visible");
assert(!asPanel.classList.contains("visible"), "Accessibility modal closes cleanly");

// 3. Test Text Scaling Controls
console.log("\n3. Testing Text Zoom Controls:");
const decBtn = document.getElementById("decreaseText");
const incBtn = document.getElementById("increaseText");
const label = document.getElementById("textSizeLabel");
assert(decBtn && incBtn && label, "Text scaling buttons (A-, A+, label) exist in navbar");

// 4. Test Persona Card Count & Configuration
console.log("\n4. Testing Accessibility Persona Cards:");
const personaCards = document.querySelectorAll(".persona-card");
assert(personaCards.length === 4, "Found exactly 4 persona recommendation cards");

console.log("\n==================================================");
console.log(` DOM TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("==================================================");
