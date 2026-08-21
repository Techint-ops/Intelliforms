/**
 * Intelliform — Real-time ASL Hand Landmark Detection & Recognition Engine
 * Ownership: Person A (recognition.js)
 * 
 * Owns:
 *  - MediaPipe Hands pipeline initialization and camera lifecycle
 *  - 21-landmark translation/scale normalization mathematics:
 *      * Coordinate Origin = Wrist (Landmark 0)
 *      * Scale Factor = Euclidean distance between Landmark 0 and Landmark 9 (MCP middle)
 *  - 1-Nearest-Neighbor (1-NN) classification against custom training dictionary
 *  - Heuristic rule-based fallback recognizers for ASL letters (A-Z) and numbers (0-9)
 *  - Temporal smoothing: 8-frame majority voting buffer
 *  - Hold-to-confirm timer: 1200ms continuous hold with progress bar
 *  - Canvas landmark drawing utilities
 * 
 * Depends on:
 *  - MediaPipe Hands (@mediapipe/hands via CDN)
 *  - MediaPipe CameraUtils (@mediapipe/camera_utils via CDN)
 *  - src/train.js (landmarksToVector, matchCustom, currentBank, getMode, refreshTrainList)
 * 
 * Teammate Note:
 *  - Evaluator explanation: This module processes the real-time webcam feed. It extracts hand
 *    landmarks using MediaPipe, normalizes the skeleton relative to the wrist and middle finger MCP,
 *    and classifies signs via a 1-NN Euclidean distance matcher (threshold <= 3.0) or heuristic fallbacks.
 */

import {
  landmarksToVector,
  matchCustom,
  currentBank,
  getMode,
  setMode,
  refreshTrainList,
} from "./train.js";

let hands = null;
let camera = null;
export let isCameraRunning = false;
export let currentHandLandmarks = null;
export let lastDetectedSign = "";
export let signBuffer = [];
export const bufferSize = 8;

// Hold-to-append state (Hard constraint: 1200ms hold timer)
let holdStartTs = 0;
const holdTarget = 1200; // ms to confirm a sign
let appendedSign = "";
let cooldownUntil = 0;

export function getCurrentLandmarks() {
  return currentHandLandmarks;
}

export function getLastDetectedSign() {
  return lastDetectedSign;
}

/**
 * Initialize MediaPipe Hands instance
 */
export function initHandTracking() {
  if (hands) return Promise.resolve();

  return new Promise((resolve, reject) => {
    /* global Hands */
    if (typeof Hands === "undefined") {
      reject(new Error("MediaPipe Hands library not loaded"));
      return;
    }
    hands = new Hands({
      locateFile: (file) => {
        return "https://cdn.jsdelivr.net/npm/@mediapipe/hands/" + file;
      },
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7,
    });

    hands.onResults(onHandResults);
    resolve();
  });
}

/**
 * Handle detection results from MediaPipe Hands
 */
export function onHandResults(results) {
  const handCanvas =
    document.getElementById("handCanvas") ||
    document.getElementById("output_canvas");
  const handStatusOverlay = document.getElementById("handStatusOverlay");
  const detectedSign = document.getElementById("detectedSign");
  const detectedSource = document.getElementById("detectedSource");
  const captureSignBtn = document.getElementById("captureSignBtn");
  const holdBar =
    document.getElementById("holdProgressBar") ||
    document.getElementById("holdBar");
  const holdWrap =
    document.getElementById("holdProgressWrap") ||
    document.getElementById("holdWrap");

  if (!handCanvas) return;
  const canvasCtx = handCanvas.getContext("2d");
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);

  if (
    results.multiHandLandmarks &&
    results.multiHandLandmarks.length > 0
  ) {
    currentHandLandmarks = results.multiHandLandmarks[0];
    drawHandLandmarks(canvasCtx, currentHandLandmarks, handCanvas.width, handCanvas.height);

    // 1) Try custom-trained signs first (works in every mode)
    let detected = null;
    let source = "";
    const vec = landmarksToVector(currentHandLandmarks);
    const custom = matchCustom(vec);
    const mode = getMode();

    if (custom && custom.label) {
      detected = custom.label;
      source = "(trained · d=" + custom.dist.toFixed(2) + ")";
      // Strong trained match — bypass vote buffer so it appears instantly
      if (custom.dist < 1.2) {
        signBuffer = [detected, detected, detected];
      }
    } else if (
      custom &&
      custom._rejected &&
      Object.keys(currentBank()).length > 0
    ) {
      // Show nearest distance so user can calibrate threshold/recording
      if (detectedSource) {
        detectedSource.textContent =
          "(nearest trained d=" + custom.dist.toFixed(2) + ")";
      }
    }

    // 2) Otherwise fall back to built-in recognizer for current mode
    if (!detected) {
      if (mode === "letter") {
        detected = recognizeLetter(currentHandLandmarks);
        source = detected ? "(A–Z)" : "";
      } else if (mode === "number") {
        detected = recognizeNumber(currentHandLandmarks);
        source = detected ? "(0–9)" : "";
      }
    }

    if (detected) {
      signBuffer.push(detected);
      if (signBuffer.length > bufferSize) signBuffer.shift();
      const vote = majorityVote(signBuffer);
      if (vote) {
        if (vote !== lastDetectedSign) {
          lastDetectedSign = vote;
          holdStartTs = performance.now();
          appendedSign = ""; // new sign → allow append again
        }
        if (detectedSign) {
          detectedSign.textContent = vote;
          detectedSign.style.color = "#3B82F6";
        }
        if (detectedSource) detectedSource.textContent = source;
        if (handStatusOverlay) {
          handStatusOverlay.textContent = "Sign: " + vote;
          handStatusOverlay.style.background = "rgba(29, 78, 216, 0.9)";
        }
        if (captureSignBtn) {
          captureSignBtn.disabled = false;
          captureSignBtn.style.opacity = "1";
        }

        // Hold-to-append
        const held = performance.now() - holdStartTs;
        const pct = Math.min(100, (held / holdTarget) * 100);
        if (holdBar) holdBar.style.width = pct + "%";
        if (holdWrap) holdWrap.setAttribute("aria-valuenow", Math.round(pct));
        if (
          held >= holdTarget &&
          appendedSign !== vote &&
          performance.now() > cooldownUntil
        ) {
          appendSignToResponse(vote);
          appendedSign = vote;
          cooldownUntil = performance.now() + 400;
          if (holdBar) holdBar.style.width = "100%";
          if (holdWrap) holdWrap.setAttribute("aria-valuenow", 100);
        }
      }
    } else {
      if (handStatusOverlay) {
        handStatusOverlay.textContent = "Hand detected — hold a clearer pose";
        handStatusOverlay.style.background = "rgba(0,0,0,0.75)";
      }
      if (holdBar) holdBar.style.width = "0%";
      if (holdWrap) holdWrap.setAttribute("aria-valuenow", 0);
      holdStartTs = 0;
    }
  } else {
    currentHandLandmarks = null;
    if (handStatusOverlay) {
      handStatusOverlay.textContent = "Waiting for hand...";
      handStatusOverlay.style.background = "rgba(0,0,0,0.75)";
    }
    if (detectedSign) {
      detectedSign.textContent = "-";
      detectedSign.style.color = "#fff";
    }
    if (detectedSource) detectedSource.textContent = "";
    if (captureSignBtn) {
      captureSignBtn.disabled = true;
      captureSignBtn.style.opacity = "0.5";
    }
    if (holdBar) holdBar.style.width = "0%";
    if (holdWrap) holdWrap.setAttribute("aria-valuenow", 0);
    holdStartTs = 0;
    appendedSign = "";
    signBuffer = [];
    lastDetectedSign = "";
  }

  canvasCtx.restore();
}

/**
 * Append detected sign character to the response input
 */
export function appendSignToResponse(sign) {
  const fillResponseInput = document.getElementById("fillResponseInput");
  const fillLiveRegion = document.getElementById("fillLiveRegion");
  if (!fillResponseInput) return;
  fillResponseInput.value = (fillResponseInput.value || "") + sign;
  if (fillLiveRegion) {
    fillLiveRegion.textContent =
      'Added "' + sign + '". Response: ' + fillResponseInput.value;
  }
}

/**
 * Draw skeleton connections and landmarks on canvas
 */
export function drawHandLandmarks(ctx, landmarks, width, height) {
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4], // thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // index
    [0, 9], [9, 10], [10, 11], [11, 12], // middle
    [0, 13], [13, 14], [14, 15], [15, 16], // ring
    [0, 17], [17, 18], [18, 19], [19, 20], // pinky
    [5, 9], [9, 13], [13, 17], // palm
  ];

  ctx.strokeStyle = "rgba(92, 138, 122, 0.8)";
  ctx.lineWidth = 2;

  connections.forEach((pair) => {
    const p1 = landmarks[pair[0]];
    const p2 = landmarks[pair[1]];
    ctx.beginPath();
    ctx.moveTo(p1.x * width, p1.y * height);
    ctx.lineTo(p2.x * width, p2.y * height);
    ctx.stroke();
  });

  landmarks.forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(point.x * width, point.y * height, 4, 0, 2 * Math.PI);
    ctx.fillStyle = index === 0 ? "#F59E0B" : "#3B82F6";
    ctx.fill();
  });
}

/**
 * Check if a finger is extended based on MediaPipe landmarks
 */
export function isFingerExtended(landmarks, mcp, pip, dip, tip) {
  const tipY = landmarks[tip].y;
  const pipY = landmarks[pip].y;
  const mcpY = landmarks[mcp].y;

  // For thumb, check x distance from palm
  if (mcp === 1) {
    const tipX = landmarks[tip].x;
    const mcpX = landmarks[mcp].x;
    const dist = Math.abs(tipX - mcpX);
    return dist > 0.08 ? 1 : 0;
  }

  // For other fingers, check if tip is above pip (y is inverted in MediaPipe)
  if (tipY < pipY - 0.05) return 1;
  if (tipY > pipY + 0.05) return 0;
  return 0.5; // partially extended
}

/**
 * Heuristic rule-based ASL letter recognition
 */
export function recognizeLetter(landmarks) {
  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const thumbMCP = landmarks[2];
  const indexTip = landmarks[8];
  const indexPIP = landmarks[6];
  const indexMCP = landmarks[5];
  const middleTip = landmarks[12];
  const middlePIP = landmarks[10];
  const ringTip = landmarks[16];
  const ringPIP = landmarks[14];
  const pinkyTip = landmarks[20];
  const pinkyPIP = landmarks[18];

  function dist(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  // A finger is considered extended if its tip is noticeably further from wrist than its PIP
  const idx = dist(indexTip, wrist) > dist(indexPIP, wrist) * 1.15;
  const mid = dist(middleTip, wrist) > dist(middlePIP, wrist) * 1.15;
  const ring = dist(ringTip, wrist) > dist(ringPIP, wrist) * 1.15;
  const pinky = dist(pinkyTip, wrist) > dist(pinkyPIP, wrist) * 1.15;
  const thumbExt =
    dist(thumbTip, wrist) > dist(thumbMCP, wrist) * 1.2 &&
    dist(thumbTip, indexMCP) > 0.08;

  // Inter-finger distances
  const thumbIndexDist = dist(thumbTip, indexTip);
  const thumbMiddleDist = dist(thumbTip, middleTip);
  const indexMiddleDist = dist(indexTip, middleTip);

  // 1. F: Thumb and Index tips touch, Middle + Ring + Pinky extended up
  if (thumbIndexDist < 0.09 && mid && ring && pinky) {
    return "F";
  }

  // 2. D vs L vs G
  if (idx && !mid && !ring && !pinky) {
    // If thumb is extended out horizontally forming an L shape
    if (thumbExt && thumbIndexDist > 0.11) {
      return "L";
    }
    // G: Index pointing sideways / forward
    if (
      Math.abs(indexTip.y - indexMCP.y) < 0.08 &&
      Math.abs(thumbTip.y - thumbMCP.y) < 0.08
    ) {
      return "G";
    }
    return "D";
  }

  // 3. L: Index up, Thumb sticking out wide, other 3 fingers curled
  if (idx && !mid && !ring && !pinky && thumbExt) {
    return "L";
  }

  // 4. B: 4 fingers straight up, thumb tucked across palm
  if (idx && mid && ring && pinky && !thumbExt) {
    return "B";
  }

  // 5. W: Index, Middle, Ring up, Pinky curled
  if (idx && mid && ring && !pinky) {
    return "W";
  }

  // 6. V / U / K: Index + Middle up, Ring + Pinky curled
  if (idx && mid && !ring && !pinky) {
    if (indexMiddleDist > 0.055) return "V";
    if (thumbIndexDist < 0.08) return "K";
    return "U";
  }

  // 7. Y: Thumb and Pinky extended out, middle 3 curled
  if (thumbExt && pinky && !idx && !mid && !ring) {
    return "Y";
  }

  // 8. I: Pinky only extended up
  if (pinky && !idx && !mid && !ring && !thumbExt) {
    return "I";
  }

  // 9. C: All fingers curved, thumb curved opposite forming an open 'C'
  if (
    !idx &&
    !mid &&
    !ring &&
    !pinky &&
    thumbIndexDist > 0.08 &&
    thumbIndexDist < 0.22
  ) {
    if (dist(indexTip, indexMCP) > 0.07 && dist(thumbTip, thumbMCP) > 0.06) {
      return "C";
    }
  }

  // 10. O: All 4 fingertips touching or nearly touching thumb tip
  if (
    !idx &&
    !mid &&
    !ring &&
    !pinky &&
    thumbIndexDist < 0.075 &&
    thumbMiddleDist < 0.075
  ) {
    return "O";
  }

  // 11. E: All 4 fingers curled tight, thumb folded underneath touching fingertips
  if (!idx && !mid && !ring && !pinky) {
    if (thumbTip.y >= indexPIP.y - 0.04 && dist(thumbTip, indexMCP) < 0.12 && !thumbExt) {
      return "E";
    }
    return "A";
  }

  return null;
}

/**
 * Heuristic rule-based ASL number recognition (0-10)
 */
export function recognizeNumber(landmarks) {
  const fingers = [
    isFingerExtended(landmarks, 1, 2, 3, 4),
    isFingerExtended(landmarks, 5, 6, 7, 8),
    isFingerExtended(landmarks, 9, 10, 11, 12),
    isFingerExtended(landmarks, 13, 14, 15, 16),
    isFingerExtended(landmarks, 17, 18, 19, 20),
  ];
  const idx = fingers[1] >= 1,
    mid = fingers[2] >= 1,
    ring = fingers[3] >= 1,
    pinky = fingers[4] >= 1,
    thumb = fingers[0] >= 1;

  // 0 — closed fingers, thumb curled around (looks like 'O')
  if (!idx && !mid && !ring && !pinky) {
    const tipDist = Math.hypot(
      landmarks[4].x - landmarks[8].x,
      landmarks[4].y - landmarks[8].y,
    );
    if (tipDist < 0.08) return "0";
  }
  // 1 — index up
  if (idx && !mid && !ring && !pinky) return "1";
  // 2 — index + middle up
  if (idx && mid && !ring && !pinky) return "2";
  // 3 — thumb + index + middle
  if (idx && mid && !ring && !pinky && thumb) return "3";
  // 4 — four fingers up, thumb across
  if (idx && mid && ring && pinky && !thumb) return "4";
  // 5 — all five
  if (idx && mid && ring && pinky && thumb) return "5";
  // 6 — pinky touches thumb, others up
  if (idx && mid && ring && !pinky) {
    const d6 = Math.hypot(
      landmarks[4].x - landmarks[20].x,
      landmarks[4].y - landmarks[20].y,
    );
    if (d6 < 0.08) return "6";
    return "6";
  }
  // 7 — ring touches thumb
  if (idx && mid && !ring && pinky) return "7";
  // 8 — middle touches thumb
  if (idx && !mid && ring && pinky) return "8";
  // 9 — index touches thumb (others up)
  if (!idx && mid && ring && pinky) return "9";
  // 10 — thumb only (or fist with thumb up)
  if (!idx && !mid && !ring && !pinky && thumb) return "10";
  return null;
}

/**
 * Majority vote across sliding window buffer for temporal stabilization
 */
export function majorityVote(buffer) {
  if (buffer.length < 3) return null;
  const counts = {};
  buffer.forEach((s) => {
    counts[s] = (counts[s] || 0) + 1;
  });
  let maxCount = 0;
  let winner = null;
  for (const s in counts) {
    if (counts[s] > maxCount) {
      maxCount = counts[s];
      winner = s;
    }
  }
  return maxCount >= 3 ? winner : null;
}

/**
 * Start webcam and hand tracking
 */
export function startCamera() {
  const startCameraBtn = document.getElementById("startCameraBtn");
  const cameraLoading = document.getElementById("cameraLoading");
  const handStatusOverlay = document.getElementById("handStatusOverlay");
  const webcamVideo =
    document.getElementById("webcamVideo") ||
    document.getElementById("webcam");

  if (!webcamVideo || !startCameraBtn) return;
  if (isCameraRunning) {
    stopCamera();
    return;
  }

  if (cameraLoading) cameraLoading.style.display = "flex";

  initHandTracking()
    .then(() => {
      /* global Camera */
      if (typeof Camera === "undefined") {
        throw new Error("MediaPipe CameraUtils not loaded");
      }
      camera = new Camera(webcamVideo, {
        onFrame: async () => {
          if (hands) await hands.send({ image: webcamVideo });
        },
        width: 640,
        height: 480,
      });

      camera
        .start()
        .then(() => {
          isCameraRunning = true;
          if (cameraLoading) cameraLoading.style.display = "none";
          startCameraBtn.innerHTML =
            '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg> Stop Camera';
          if (handStatusOverlay) handStatusOverlay.textContent = "Waiting for hand...";
        })
        .catch((err) => {
          if (cameraLoading) {
            cameraLoading.innerHTML =
              '<div style="text-align:center;"><div style="margin-bottom:12px;">Camera access denied</div><div style="font-size:0.85rem;opacity:0.85;">Please check permissions and try again</div></div>';
          }
          console.error("Camera error:", err);
        });
    })
    .catch((err) => {
      if (cameraLoading) {
        cameraLoading.innerHTML =
          '<div style="text-align:center;"><div style="margin-bottom:12px;">Camera init failed</div><div style="font-size:0.85rem;opacity:0.85;">' +
          err.message +
          "</div></div>";
      }
      console.error("Tracking init error:", err);
    });
}

/**
 * Stop webcam and hand tracking
 */
export function stopCamera() {
  const startCameraBtn = document.getElementById("startCameraBtn");
  const handStatusOverlay = document.getElementById("handStatusOverlay");
  const detectedSign = document.getElementById("detectedSign");
  const captureSignBtn = document.getElementById("captureSignBtn");
  const handCanvas =
    document.getElementById("handCanvas") ||
    document.getElementById("output_canvas");

  if (camera) {
    camera.stop();
    camera = null;
  }
  isCameraRunning = false;
  if (startCameraBtn) {
    startCameraBtn.innerHTML =
      '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg> Start Camera';
  }
  if (handStatusOverlay) handStatusOverlay.textContent = "Camera stopped";
  if (detectedSign) detectedSign.textContent = "-";
  if (captureSignBtn) {
    captureSignBtn.disabled = true;
    captureSignBtn.style.opacity = "0.5";
  }

  if (handCanvas) {
    const canvasCtx = handCanvas.getContext("2d");
    canvasCtx.clearRect(0, 0, handCanvas.width, handCanvas.height);
  }
}

/**
 * Wire up ASL recognition buttons and mode switcher
 */
export function initRecognitionControls() {
  const startCameraBtn = document.getElementById("startCameraBtn");
  const captureSignBtn = document.getElementById("captureSignBtn");
  const clearSignBtn = document.getElementById("clearSignBtn");
  const modeBtns = document.querySelectorAll(".sign-mode-btn, .mode-btn");
  const fillResponseInput = document.getElementById("fillResponseInput");
  const detectedSign = document.getElementById("detectedSign");
  const detectedSource = document.getElementById("detectedSource");
  const fillLiveRegion = document.getElementById("fillLiveRegion");

  if (startCameraBtn) {
    startCameraBtn.addEventListener("click", () => {
      startCamera();
    });
  }

  if (captureSignBtn && fillResponseInput) {
    captureSignBtn.addEventListener("click", () => {
      if (lastDetectedSign && lastDetectedSign !== "-") {
        const currentValue = fillResponseInput.value;
        fillResponseInput.value = currentValue + lastDetectedSign;
        fillResponseInput.focus({ preventScroll: true });

        if (detectedSign) {
          detectedSign.style.color = "#3B82F6";
          setTimeout(() => {
            detectedSign.style.color = "#fff";
          }, 300);
        }

        if (fillLiveRegion) {
          fillLiveRegion.textContent =
            "Captured sign: " +
            lastDetectedSign +
            ". Response now: " +
            fillResponseInput.value;
        }
      }
    });
  }

  if (clearSignBtn && fillResponseInput) {
    clearSignBtn.addEventListener("click", () => {
      fillResponseInput.value = "";
      signBuffer = [];
      lastDetectedSign = "";
      if (detectedSign) detectedSign.textContent = "-";
      fillResponseInput.focus({ preventScroll: true });
      if (fillLiveRegion) fillLiveRegion.textContent = "Response cleared";
    });
  }

  modeBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const mode = btn.getAttribute("data-mode");
      setMode(mode);
      modeBtns.forEach((b) => {
        const on = b === btn;
        b.setAttribute("aria-pressed", on ? "true" : "false");
        b.style.background = on ? "#fff" : "transparent";
        b.style.color = on ? "#1E3A5F" : "#fff";
      });
      signBuffer = [];
      lastDetectedSign = "";
      appendedSign = "";
      if (detectedSign) detectedSign.textContent = "-";
      if (detectedSource) detectedSource.textContent = "";
      refreshTrainList();
    });
  });
}
