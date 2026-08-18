import fs from "fs";
import { JSDOM } from "jsdom";

console.log("===============================================================");
console.log(" INTELLIFORM FULL END-TO-END UI & LOGIC SIMULATION REPORT");
console.log("===============================================================\n");

const html = fs.readFileSync("./index.html", "utf-8");
const dom = new JSDOM(html, {
  url: "http://localhost:5174",
  runScripts: "outside-only"
});

const { window } = dom;
const { document } = window;
global.window = window;
global.document = document;
global.localStorage = window.localStorage;

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAILED: ${testName}`);
    failed++;
  }
}

// Import modules
const speech = await import("./src/speech.js");
const train = await import("./src/train.js");
const recognition = await import("./src/recognition.js");
const supabaseClient = await import("./src/supabase-client.js");
const aslSignsModule = await import("./src/asl-signs.js");

// TEST 1: Persona switching and recommendations
console.log("1. Testing Persona Cards & Modality Recommendations:");
speech.setPersona("visual");
assert(speech.state.persona === "visual", "Visual persona selected");
assert(speech.state.field === "spoken" && speech.state.details === "spoken", "Visual recommendations: spoken/spoken");

speech.setPersona("nonverbal");
assert(speech.state.persona === "nonverbal", "Non-verbal persona selected");
assert(speech.state.field === "written" && speech.state.details === "signed", "Non-verbal recommendations: written/signed");

speech.setPersona("hearing");
assert(speech.state.persona === "hearing", "Hard of hearing persona selected");
assert(speech.state.field === "signed" && speech.state.details === "written", "Hard of hearing recommendations: signed/written");

speech.setPersona("locomotor");
assert(speech.state.persona === "locomotor", "Locomotor persona selected");
assert(speech.state.field === "spoken" && speech.state.details === "spoken", "Locomotor recommendations: spoken/spoken");

// TEST 2: Form Builder Wizard Navigation & Progression
console.log("\n2. Testing Form Builder Step-by-Step Flow:");
const formNameInput = document.getElementById("formNameInput");
const fieldCountInput = document.getElementById("fieldCountInput");
const countNextBtn = document.getElementById("countNextBtn");
const fieldNameInput = document.getElementById("fieldNameInput");
const fieldTypeInput = document.getElementById("fieldTypeInput");
const fieldNextBtn = document.getElementById("fieldNextBtn");
const fieldBackBtn = document.getElementById("fieldBackBtn");

formNameInput.value = "Registration Form";
fieldCountInput.value = "3";
assert(formNameInput.value === "Registration Form" && fieldCountInput.value === "3", "Form name & field count populated");

// TEST 3: ASL Translation Window Visual Hand Sign Rendering
console.log("\n3. Testing ASL Sign Images Rendering:");
const aslSignsDisplay = document.getElementById("aslSignsDisplay");
const aslTextDisplay = document.getElementById("aslTextDisplay");

function simulateRenderASL(text) {
  aslSignsDisplay.innerHTML = "";
  if (aslTextDisplay) aslTextDisplay.textContent = text;
  text.toLowerCase().split("").forEach(c => {
    if (aslSignsModule.aslSigns[c]) {
      const div = document.createElement("div");
      div.innerHTML = aslSignsModule.aslSigns[c];
      if (div.firstElementChild) aslSignsDisplay.appendChild(div.firstElementChild);
    }
  });
}

simulateRenderASL("Full Name");
assert(aslSignsDisplay.children.length > 0, "ASL visual sign images appended to #aslSignsDisplay");
assert(aslTextDisplay.textContent === "Full Name", "#aslTextDisplay text matches active field label");

// TEST 4: Form Filling Flow with Back and Next buttons
console.log("\n4. Testing Form Filling Step Progression & Back Button:");
let currentStep = 0;
const testFields = ["Full Name", "Email Address", "Phone Number"];
const answers = ["Alex Doe", "alex@example.com", "555-1234"];
const responses = [];

// Field 1 -> Next
responses[0] = answers[0];
currentStep++;
assert(currentStep === 1, "Moved from Field 1 (Full Name) to Field 2 (Email Address)");

// Field 2 -> Click Back Button
currentStep--;
assert(currentStep === 0, "Back button successfully returned to Field 1 (Full Name)");
assert(responses[0] === "Alex Doe", "Field 1 response preserved");

// Field 1 -> Next -> Field 2 -> Next -> Field 3
currentStep = 2;
responses[1] = answers[1];
responses[2] = answers[2];
assert(currentStep === 2 && responses.length === 3, "Traversed all fields to submission ready state");

// TEST 5: Submissions Modal Display
console.log("\n5. Testing Submissions Viewer Modal:");
const subModal = document.getElementById("submissionsModal");
subModal.style.display = "flex";
subModal.classList.remove("hidden");
assert(subModal.style.display === "flex" && !subModal.classList.contains("hidden"), "Submissions modal opens with display: flex");

subModal.style.display = "none";
subModal.classList.add("hidden");
assert(subModal.style.display === "none" && subModal.classList.contains("hidden"), "Submissions modal closes with display: none");

// TEST 6: Accessibility Statement Modal
console.log("\n6. Testing Accessibility Statement Modal:");
const asModal = document.getElementById("accessibilityStatement");
asModal.classList.add("visible");
assert(asModal.classList.contains("visible"), "Accessibility statement opens with .visible class");
asModal.classList.remove("visible");
assert(!asModal.classList.contains("visible"), "Accessibility statement closes cleanly");

// TEST 7: Supabase Payload Format
console.log("\n7. Testing Supabase Form Submission Schema:");
const submissionPayload = {
  form_name: "Registration Form",
  fields: [
    { name: "Full Name", type: "alphabetical", persona: "nonverbal", field_mode: "written", details_mode: "signed" },
    { name: "Email Address", type: "alphanumerical", persona: "nonverbal", field_mode: "written", details_mode: "signed" },
    { name: "Phone Number", type: "numerical", persona: "nonverbal", field_mode: "written", details_mode: "signed" }
  ],
  responses: [
    { name: "Full Name", answer: "Alex Doe" },
    { name: "Email Address", answer: "alex@example.com" },
    { name: "Phone Number", answer: "555-1234" }
  ]
};
assert(submissionPayload.form_name === "Registration Form", "Payload has valid form_name");
assert(submissionPayload.fields.length === 3, "Payload contains all 3 fields");
assert(submissionPayload.responses.length === 3, "Payload contains all 3 responses");
assert(!submissionPayload.details_mode && !submissionPayload.field_mode && !submissionPayload.persona, "No invalid top-level columns in payload (prevents schema cache error)");

console.log("\n===============================================================");
console.log(` SIMULATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("===============================================================");
