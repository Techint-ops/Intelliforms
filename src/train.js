/**
 * Intelliform — ASL Gesture Training Engine & Cloud Sync
 * Ownership: Person D (supabase-client.js + train.js + deployment/env config)
 * 
 * Owns:
 *  - ASL gesture vector dataset management (localStorage + Supabase `trained_signs` table)
 *  - Vector math: translation/scale-invariant normalization (42-dim vector)
 *  - Euclidean vector distance calculation
 *  - 1-NN custom sample matcher (with 3.0 distance threshold)
 *  - Training panel UI controls (record sample, clear label, export/import JSON)
 *  - Multi-device Cloud Sync Code management
 * 
 * Depends on:
 *  - src/supabase-client.js (sb client)
 * 
 * Teammate Note:
 *  - Evaluator explanation: This module allows users and researchers to record custom ASL gesture samples.
 *    Landmarks are converted into translation- and scale-invariant 42-dimensional vectors and matched using
 *    a 1-nearest-neighbor algorithm or synchronized across devices via sync codes.
 */

import { sb } from "./supabase-client.js";

export const STORAGE_KEY = "aslCustomSigns.v1";
export const SYNC_CODE_KEY = "aslSyncCode.v1";

// Shape: { letter: { label: [vec,...] }, number: { label: [vec,...] } }
export let customSignsByMode = loadCustomSigns();
export let currentMode = "letter"; // 'letter' | 'number'
export let syncCode = null;

export function getMode() {
  return currentMode;
}

export function setMode(m) {
  currentMode = m;
}

export function currentBank() {
  if (!customSignsByMode[currentMode]) customSignsByMode[currentMode] = {};
  return customSignsByMode[currentMode];
}

export function setSyncStatus(msg) {
  const el = document.getElementById("syncStatus");
  if (el) el.textContent = msg;
}

// Encode mode in sync_code so letters and numbers stay separate in the cloud.
export function cloudKey(code, m) {
  return m === "number" ? code + "::number" : code;
}

export async function cloudLoadAll(code) {
  const client = sb || window.sb;
  if (!client) throw new Error("Cloud client not loaded");
  let loaded = 0;
  const modes = ["letter", "number"];
  for (let mi = 0; mi < modes.length; mi++) {
    const m = modes[mi];
    const res = await client
      .from("trained_signs")
      .select("label,vector")
      .eq("sync_code", cloudKey(code, m));
    if (res.error) throw res.error;
    if (res.data && res.data.length > 0) {
      customSignsByMode[m] = {};
      const bank = customSignsByMode[m];
      res.data.forEach((row) => {
        if (!bank[row.label]) bank[row.label] = [];
        if (Array.isArray(row.vector)) {
          bank[row.label].push(row.vector);
          loaded++;
        }
      });
    }
  }
  saveCustomSigns();
  return loaded;
}

export async function cloudPushSample(m, label, vec) {
  const client = sb || window.sb;
  if (!client || !syncCode) return;
  try {
    await client.from("trained_signs").insert({
      sync_code: cloudKey(syncCode, m),
      label: label,
      vector: vec,
    });
  } catch (e) {
    console.warn("cloud push failed", e);
  }
}

export async function cloudDeleteLabel(m, label) {
  const client = sb || window.sb;
  if (!client || !syncCode) return;
  try {
    await client
      .from("trained_signs")
      .delete()
      .eq("sync_code", cloudKey(syncCode, m))
      .eq("label", label);
  } catch (e) {
    console.warn("cloud delete failed", e);
  }
}

export function loadCustomSigns() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    const keys = Object.keys(raw);
    const looksOld =
      keys.length > 0 &&
      keys.indexOf("letter") === -1 &&
      keys.indexOf("number") === -1;
    if (looksOld) return { letter: raw, number: {} };
    if (!raw.letter) raw.letter = {};
    if (!raw.number) raw.number = {};
    return raw;
  } catch (e) {
    return { letter: {}, number: {} };
  }
}

export function saveCustomSigns() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customSignsByMode));
  } catch (e) {}
}

/**
 * Normalize 21 landmarks to a translation/scale-invariant 42-dim vector.
 * Coordinate Origin: Landmark 0 (wrist)
 * Normalization Scale: Distance between Landmark 0 and Landmark 9 (middle MCP)
 */
export function landmarksToVector(lms) {
  const ox = lms[0].x,
    oy = lms[0].y;
  const mx = lms[9].x - ox,
    my = lms[9].y - oy;
  const scale = Math.sqrt(mx * mx + my * my) || 1;
  const v = [];
  for (let i = 0; i < lms.length; i++) {
    v.push((lms[i].x - ox) / scale);
    v.push((lms[i].y - oy) / scale);
  }
  return v;
}

export function vecDistance(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

/**
 * 1-NN against custom samples for the CURRENT mode only; returns {label, dist}
 * Hard constraint: distance threshold < 3.0
 */
export function matchCustom(vec) {
  const bank = currentBank();
  let best = null,
    bestDist = Infinity;
  for (const label in bank) {
    const arr = bank[label];
    for (let i = 0; i < arr.length; i++) {
      const d = vecDistance(vec, arr[i]);
      if (d < bestDist) {
        bestDist = d;
        best = label;
      }
    }
  }
  if (best && bestDist < 3.0) return { label: best, dist: bestDist };
  return { label: null, dist: bestDist, _rejected: true };
}

export function refreshTrainList() {
  const trainSamplesList = document.getElementById("trainSamplesList");
  if (!trainSamplesList) return;
  trainSamplesList.innerHTML = "";
  const bank = currentBank();
  const labels = Object.keys(bank);
  const header = document.createElement("span");
  header.style.cssText = "opacity:0.85; font-size:0.8rem; width:100%;";
  header.textContent =
    "Training " +
    (currentMode === "number" ? "Numbers (0–9)" : "Letters (A–Z)") +
    " · " +
    labels.length +
    " label(s)";
  trainSamplesList.appendChild(header);
  if (labels.length === 0) {
    const empty = document.createElement("span");
    empty.style.cssText = "opacity:0.85; font-size:0.8rem;";
    empty.textContent = "No custom " + currentMode + " signs yet.";
    trainSamplesList.appendChild(empty);
    return;
  }
  labels.forEach((l) => {
    const chip = document.createElement("span");
    chip.textContent = l + " (" + bank[l].length + ")";
    chip.style.cssText =
      "background:rgba(255,255,255,0.12); padding:4px 10px; border-radius:999px; font-size:0.8rem;";
    trainSamplesList.appendChild(chip);
  });
}

/**
 * Initialize all event listeners and DOM wiring for the Train panel.
 */
export function initTrainPanel(getCurrentLandmarks) {
  const trainRecordBtn = document.getElementById("trainRecordBtn");
  const trainClearLabelBtn = document.getElementById("trainClearLabelBtn");
  const trainLabelInput = document.getElementById("trainLabelInput");
  const trainStatus = document.getElementById("trainStatus");
  const syncCodeInput = document.getElementById("syncCodeInput");
  const syncConnectBtn = document.getElementById("syncConnectBtn");
  const syncDisconnectBtn = document.getElementById("syncDisconnectBtn");
  const syncUploadBtn = document.getElementById("syncUploadBtn");
  const syncReplaceBtn = document.getElementById("syncReplaceBtn");
  const trainExportBtn = document.getElementById("trainExportBtn");
  const trainImportBtn = document.getElementById("trainImportBtn");
  const trainImportFile = document.getElementById("trainImportFile");

  function applySyncUI() {
    if (!syncConnectBtn || !syncDisconnectBtn || !syncCodeInput) return;
    if (syncCode) {
      syncConnectBtn.style.display = "none";
      syncDisconnectBtn.style.display = "";
      syncCodeInput.value = syncCode;
      syncCodeInput.disabled = true;
    } else {
      syncConnectBtn.style.display = "";
      syncDisconnectBtn.style.display = "none";
      syncCodeInput.disabled = false;
    }
  }

  if (trainRecordBtn && trainLabelInput) {
    trainRecordBtn.addEventListener("click", () => {
      const label = (trainLabelInput.value || "").trim();
      if (!label) {
        if (trainStatus) trainStatus.textContent = "Type a label first.";
        return;
      }
      const lms = getCurrentLandmarks ? getCurrentLandmarks() : null;
      if (!lms) {
        if (trainStatus)
          trainStatus.textContent =
            "No hand detected — show your hand to the camera first.";
        return;
      }
      const bank = currentBank();
      if (!bank[label]) bank[label] = [];
      const vec = landmarksToVector(lms);
      bank[label].push(vec);
      saveCustomSigns();
      if (trainStatus) {
        trainStatus.textContent =
          "[" +
          currentMode +
          '] Sample saved for "' +
          label +
          '" — total ' +
          bank[label].length +
          (syncCode ? " (syncing…)" : "") +
          ". Record 5+ varied samples for best accuracy.";
      }
      refreshTrainList();
      cloudPushSample(currentMode, label, vec);
    });
  }

  if (trainClearLabelBtn && trainLabelInput) {
    trainClearLabelBtn.addEventListener("click", () => {
      const label = (trainLabelInput.value || "").trim();
      const bank = currentBank();
      if (!label || !bank[label]) {
        if (trainStatus)
          trainStatus.textContent =
            "No samples saved under that label in " + currentMode + " mode.";
        return;
      }
      delete bank[label];
      saveCustomSigns();
      if (trainStatus) {
        trainStatus.textContent =
          "[" + currentMode + '] Deleted all samples for "' + label + '".';
      }
      refreshTrainList();
      cloudDeleteLabel(currentMode, label);
    });
  }

  if (syncConnectBtn && syncCodeInput) {
    syncConnectBtn.addEventListener("click", async () => {
      const code = (syncCodeInput.value || "").trim();
      if (!code) {
        setSyncStatus("Enter a code first.");
        return;
      }
      const client = sb || window.sb;
      if (!client) {
        setSyncStatus("Cloud unavailable — check your internet.");
        return;
      }
      syncConnectBtn.disabled = true;
      setSyncStatus("Connecting & loading signs from cloud…");
      try {
        const loaded = await cloudLoadAll(code);
        syncCode = code;
        try {
          localStorage.setItem(SYNC_CODE_KEY, code);
        } catch (e) {}
        applySyncUI();
        refreshTrainList();
        setSyncStatus(
          'Connected as "' +
            code +
            '". Loaded ' +
            loaded +
            " sample(s). New training auto-syncs.",
        );
      } catch (e) {
        setSyncStatus("Connect failed: " + (e.message || e));
      }
      syncConnectBtn.disabled = false;
    });
  }

  if (syncDisconnectBtn) {
    syncDisconnectBtn.addEventListener("click", () => {
      syncCode = null;
      try {
        localStorage.removeItem(SYNC_CODE_KEY);
      } catch (e) {}
      applySyncUI();
      setSyncStatus(
        "Disconnected. Trained signs stay on this device; new ones won't sync.",
      );
    });
  }

  if (syncUploadBtn) {
    syncUploadBtn.addEventListener("click", async () => {
      const client = sb || window.sb;
      if (!client) {
        setSyncStatus("Cloud unavailable — check your internet.");
        return;
      }
      if (!syncCode) {
        setSyncStatus("Connect a sync code first, then upload.");
        return;
      }
      syncUploadBtn.disabled = true;
      const rows = [];
      const modes = ["letter", "number"];
      for (let mi = 0; mi < modes.length; mi++) {
        const m = modes[mi];
        const bank = customSignsByMode[m] || {};
        Object.keys(bank).forEach((label) => {
          (bank[label] || []).forEach((vec) => {
            rows.push({
              sync_code: cloudKey(syncCode, m),
              label: label,
              vector: vec,
            });
          });
        });
      }
      if (!rows.length) {
        setSyncStatus("No local signs to upload.");
        syncUploadBtn.disabled = false;
        return;
      }
      setSyncStatus('Uploading ' + rows.length + ' sample(s) to "' + syncCode + '"…');
      try {
        // Clear previous cloud entries for this sync_code so duplicates do not accumulate
        for (let mi2 = 0; mi2 < modes.length; mi2++) {
          await client
            .from("trained_signs")
            .delete()
            .eq("sync_code", cloudKey(syncCode, modes[mi2]));
        }

        const CHUNK = 100;
        let uploaded = 0;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const slice = rows.slice(i, i + CHUNK);
          const res = await client.from("trained_signs").insert(slice);
          if (res.error) throw res.error;
          uploaded += slice.length;
          setSyncStatus("Uploaded " + uploaded + "/" + rows.length + "…");
        }
        setSyncStatus(
          'Uploaded ' +
            uploaded +
            ' sample(s) to "' +
            syncCode +
            '". They\'ll load on any device using this code.',
        );
      } catch (e) {
        setSyncStatus("Upload failed: " + (e.message || e));
      }
      syncUploadBtn.disabled = false;
    });
  }

  if (syncReplaceBtn) {
    syncReplaceBtn.addEventListener("click", async () => {
      const client = sb || window.sb;
      if (!client) {
        setSyncStatus("Cloud unavailable — check your internet.");
        return;
      }
      if (!syncCode) {
        setSyncStatus("Connect a sync code first, then replace.");
        return;
      }
      if (
        !confirm(
          'This will DELETE all cloud signs stored under "' +
            syncCode +
            '" (letters and numbers) and replace them with the signs currently on this device. Continue?',
        )
      )
        return;
      syncReplaceBtn.disabled = true;
      const rows = [];
      const modes = ["letter", "number"];
      for (let mi = 0; mi < modes.length; mi++) {
        const m = modes[mi];
        const bank = customSignsByMode[m] || {};
        Object.keys(bank).forEach((label) => {
          (bank[label] || []).forEach((vec) => {
            rows.push({
              sync_code: cloudKey(syncCode, m),
              label: label,
              vector: vec,
            });
          });
        });
      }
      setSyncStatus('Deleting existing cloud signs for "' + syncCode + '"…');
      try {
        for (let mi2 = 0; mi2 < modes.length; mi2++) {
          const delRes = await client
            .from("trained_signs")
            .delete()
            .eq("sync_code", cloudKey(syncCode, modes[mi2]));
          if (delRes.error) throw delRes.error;
        }
        if (!rows.length) {
          setSyncStatus('Cloud cleared for "' + syncCode + '". No local signs to upload.');
          syncReplaceBtn.disabled = false;
          return;
        }
        setSyncStatus("Uploading " + rows.length + " sample(s)…");
        const CHUNK = 100;
        let uploaded = 0;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const slice = rows.slice(i, i + CHUNK);
          const res = await client.from("trained_signs").insert(slice);
          if (res.error) throw res.error;
          uploaded += slice.length;
          setSyncStatus("Uploaded " + uploaded + "/" + rows.length + "…");
        }
        setSyncStatus(
          'Replaced cloud for "' +
            syncCode +
            '" with ' +
            uploaded +
            " local sample(s).",
        );
      } catch (e) {
        setSyncStatus("Replace failed: " + (e.message || e));
      }
      syncReplaceBtn.disabled = false;
    });
  }

  // Auto-connect to saved sync code or default to techint6 on initial load
  try {
    const savedCode = localStorage.getItem(SYNC_CODE_KEY) || "techint6";
    const client = sb || window.sb;
    if (savedCode && client) {
      if (syncCodeInput) syncCodeInput.value = savedCode;
      setSyncStatus('Connecting to cloud signs ("' + savedCode + '")…');
      cloudLoadAll(savedCode)
        .then((loaded) => {
          syncCode = savedCode;
          applySyncUI();
          refreshTrainList();
          setSyncStatus(
            'Connected as "' +
              savedCode +
              '". Loaded ' +
              loaded +
              " trained sample(s) from cloud.",
          );
        })
        .catch((e) => {
          setSyncStatus("Auto-sync failed: " + (e.message || e));
        });
    }
  } catch (e) {}

  if (trainExportBtn) {
    trainExportBtn.addEventListener("click", () => {
      try {
        const data = JSON.stringify(customSignsByMode, null, 2);
        const blob = new Blob([data], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "trained-signs.json";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 0);
        const nL = Object.keys(customSignsByMode.letter || {}).length;
        const nN = Object.keys(customSignsByMode.number || {}).length;
        if (trainStatus) {
          trainStatus.textContent =
            "Exported " + nL + " letter label(s) and " + nN + " number label(s).";
        }
      } catch (e) {
        if (trainStatus) trainStatus.textContent = "Export failed: " + e.message;
      }
    });
  }

  if (trainImportBtn && trainImportFile) {
    trainImportBtn.addEventListener("click", () => {
      trainImportFile.click();
    });
    trainImportFile.addEventListener("change", (ev) => {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const imported = JSON.parse(reader.result);
          if (!imported || typeof imported !== "object")
            throw new Error("Invalid file");
          let added = 0;
          const isNew = imported.letter || imported.number;
          const sources = isNew
            ? [
                ["letter", imported.letter || {}],
                ["number", imported.number || {}],
              ]
            : [["letter", imported]];
          sources.forEach((pair) => {
            const m = pair[0],
              obj = pair[1];
            if (!customSignsByMode[m]) customSignsByMode[m] = {};
            const bank = customSignsByMode[m];
            for (const label in obj) {
              if (!Array.isArray(obj[label])) continue;
              if (!bank[label]) bank[label] = [];
              for (let i = 0; i < obj[label].length; i++) {
                if (Array.isArray(obj[label][i])) {
                  bank[label].push(obj[label][i]);
                  added++;
                }
              }
            }
          });
          saveCustomSigns();
          refreshTrainList();
        } catch (e) {
          if (trainStatus) trainStatus.textContent = "Import failed: " + e.message;
        }
        trainImportFile.value = "";
      };
      reader.readAsText(file);
    });
  }

  const trainResetAllBtn = document.getElementById("trainResetAllBtn");
  if (trainResetAllBtn) {
    trainResetAllBtn.addEventListener("click", () => {
      if (
        !confirm(
          "Are you sure you want to clear all locally trained signs on this device? This will reset your sign list.",
        )
      )
        return;
      customSignsByMode = { letter: {}, number: {} };
      saveCustomSigns();
      refreshTrainList();
      if (trainStatus) {
        trainStatus.textContent = "All local trained signs have been cleared.";
      }
    });
  }

  refreshTrainList();
}
