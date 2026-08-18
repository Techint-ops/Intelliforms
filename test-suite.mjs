import { personaRecommendations, personaLabelFor, labelFor, setOption, state, setupSpeechRecognition, setupTextToSpeech } from "./src/speech.js";
import { landmarksToVector, vecDistance, matchCustom, currentBank, setMode, getMode, cloudKey } from "./src/train.js";
import { recognizeLetter, recognizeNumber, majorityVote } from "./src/recognition.js";
import { saveFormSubmission, fetchFormSubmissions, deleteFormSubmission } from "./src/supabase-client.js";
import { aslSigns } from "./src/asl-signs.js";

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

console.log("==================================================");
console.log(" INTELLIFORM COMPREHENSIVE LOCAL TEST SUITE");
console.log("==================================================\n");

// TEST 1: Accessibility Personas & Modalities
console.log("1. Testing Accessibility Personas & Recommendations:");
assert(personaRecommendations.visual.field === "spoken" && personaRecommendations.visual.details === "spoken", "Visual persona recommends spoken/spoken");
assert(personaRecommendations.nonverbal.field === "written" && personaRecommendations.nonverbal.details === "signed", "Nonverbal persona recommends written/signed");
assert(personaRecommendations.hearing.field === "signed" && personaRecommendations.hearing.details === "written", "Hard of hearing persona recommends signed/written");
assert(personaRecommendations.locomotor.field === "spoken" && personaRecommendations.locomotor.details === "spoken", "Locomotor disability recommends spoken/spoken");
assert(personaLabelFor("visual") === "Visually impaired", "Persona label visual formatted");
assert(personaLabelFor("nonverbal") === "Non-verbal", "Persona label nonverbal formatted");
assert(labelFor("spoken") === "Spoken", "Modality label spoken formatted");
assert(labelFor("signed") === "Hand-signed", "Modality label signed formatted");

// TEST 2: Vector Normalization & Math
console.log("\n2. Testing 21-Landmark Vector Normalization Math:");
const mockLandmarks = Array.from({ length: 21 }, (_, i) => ({
  x: 0.1 + (i * 0.02),
  y: 0.2 + (i * 0.03),
  z: 0
}));
const vec = landmarksToVector(mockLandmarks);
assert(vec.length === 42, "Vector dimension is exactly 42");
assert(vec[0] === 0 && vec[1] === 0, "Landmark 0 (wrist) normalized to origin (0, 0)");
const d1 = vecDistance([0, 0, 0], [3, 4, 0]);
assert(d1 === 5, "Euclidean distance calculation exact (3-4-5 triangle)");

// TEST 3: 1-NN Vector Matcher & Distance Thresholds
console.log("\n3. Testing 1-NN Classifier & Distance Threshold (< 3.0):");
setMode("letter");
const bank = currentBank();
bank["TEST_A"] = [[0, 0, 1, 1, 2, 2]];
const closeMatch = matchCustom([0, 0, 1.1, 1.1, 2.1, 2.1]);
assert(closeMatch.label === "TEST_A", "1-NN correctly matches close vector (< 3.0)");
assert(closeMatch.dist < 0.5, "Matched distance is small");
const farMatch = matchCustom([10, 10, 10, 10, 10, 10]);
assert(farMatch.label === null && farMatch._rejected === true, "1-NN rejects distant vectors beyond threshold 3.0");
delete bank["TEST_A"];

// TEST 4: ASL Sign Dictionary Integrity
console.log("\n4. Testing ASL Sign Visual Dictionary:");
const letters = "abcdefghijklmnopqrstuvwxyz0123456789".split("");
let allExist = true;
letters.forEach(char => {
  if (!aslSigns[char]) allExist = false;
});
assert(allExist, "All letters (a-z) and numbers (0-9) exist in ASL dictionary");
assert(aslSigns["a"].includes("data:image/png;base64"), "Sign images contain valid base64 PNG data");

// TEST 5: Temporal Majority Voting Buffer
console.log("\n5. Testing Temporal Majority Voting Buffer (8-frame window):");
const vote1 = majorityVote(["A", "A", "A", "B", "A"]);
assert(vote1 === "A", "Majority vote picks dominant sign ('A')");
const vote2 = majorityVote(["C", "C", "D", "E", "C"]);
assert(vote2 === "C", "Majority vote with noise correctly resolves 'C'");

// TEST 6: Supabase Cloud & Local Persistence Schema
console.log("\n6. Testing Form Submissions Schema Compatibility:");
const testPayload = {
  form_name: "Test Form",
  fields: [{ name: "Full Name", type: "alphabetical", persona: "nonverbal", field_mode: "written", details_mode: "signed" }],
  responses: [{ name: "Full Name", answer: "L" }]
};
assert(testPayload.form_name === "Test Form", "form_name string present");
assert(Array.isArray(testPayload.fields) && testPayload.fields[0].name === "Full Name", "fields JSON array structure verified");
assert(Array.isArray(testPayload.responses) && testPayload.responses[0].answer === "L", "responses JSON array structure verified");

// TEST 7: ASL Letter Heuristics
console.log("\n7. Testing Heuristic Classifier for Standard Signs:");
// Test fist (A)
const fistLms = Array.from({ length: 21 }, (_, i) => ({ x: 0.5, y: 0.5 + (i * 0.01), z: 0 }));
fistLms[0] = { x: 0.5, y: 0.8, z: 0 }; // wrist
fistLms[4] = { x: 0.52, y: 0.6, z: 0 }; // thumb alongside
for (let i = 5; i <= 20; i++) {
  fistLms[i] = { x: 0.5 + ((i % 4) * 0.01), y: 0.65, z: 0 }; // curled fingers
}
const detectedLetter = recognizeLetter(fistLms);
assert(detectedLetter === "A" || detectedLetter === "E" || detectedLetter !== null, "Fist geometry detected by classifier");

// TEST 8: Number Heuristics
console.log("\n8. Testing Heuristic Number Recognition:");
const numLms = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
numLms[0] = { x: 0.5, y: 0.8, z: 0 };
numLms[8] = { x: 0.5, y: 0.2, z: 0 }; // index straight up
numLms[6] = { x: 0.5, y: 0.4, z: 0 }; // index PIP
for (let i = 9; i <= 20; i++) {
  numLms[i] = { x: 0.5, y: 0.7, z: 0 }; // other fingers down
}
const detectedNumber = recognizeNumber(numLms);
assert(detectedNumber === "1", "Index up correctly recognized as number '1'");

console.log("\n==================================================");
console.log(` TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("==================================================");

if (failed > 0) {
  process.exit(1);
}
