# Intelliform

> **AI-Enabled Digital Accessibility Platform**  
> Empowering users with diverse physical, sensory, and cognitive abilities to fill out digital forms seamlessly through multi-modal inputs (Voice/Speech, ASL Hand Signs, Audio Prompts, and Keyboard) with Public Kiosk Profile Support.

---

## 🌟 Key Features & Innovations

- **🖐️ Real-Time ASL Hand Sign Recognition**:
  - 21 3D hand landmark tracking via **MediaPipe Hands**.
  - Translation and scale-invariant 42-dimensional vector normalization.
  - Hybrid classification engine (1-Nearest Neighbor Euclidean matching + geometric heuristic rules for A–Z and 0–9).
  - **Hands-Free Gesture Navigation**: Hold **Thumbs-Up (👍)** for 1.2s to go to the **Next Field**, or **Thumbs-Down (👎)** for 1.2s to return to the **Previous Field**.
- **🎙️ Speech Synthesis & Voice Recognition**:
  - Natural screen-reader read-aloud via **Web Speech API TTS**.
  - Continuous speech-to-text response capture with hands-free voice command parsing (`"next"`, `"previous"`, `"finish"`, `"submit"`).
- **🔑 Kiosk-Friendly Profile Authentication (Username + 4-Digit PIN)**:
  - Touch-friendly quick authentication designed for public kiosks, clinics, and school tablets.
  - Automatically loads user's personal ASL sign calibrations upon sign-in.
  - 1-click *"Switch Profile / Logout"* for multi-user shared devices.
- **⚡ One-Click Accessible Form Templates**:
  - 🏥 *Patient Medical Intake*
  - 🎓 *Student Accessibility Registration*
  - 💼 *Job Application Form*
- **📊 Multi-Format Submissions Export**:
  - **Export CSV**: Instant spreadsheet download with timestamps, form metadata, and responses.
  - **Print / Save PDF**: High-contrast, formatted printable cards for compliance and archiving.
- **🛡️ Cloud Sync & Offline Resilience**:
  - Automatic synchronization with **Supabase** cloud database (`user_profiles`, `form_submissions`, `trained_signs`).
  - Graceful, silent offline fallback to browser `localStorage` when disconnected.

---

## ♿ Accessibility Personas

| Persona | Field Presentation | Response Capture | Target User Need |
| :--- | :--- | :--- | :--- |
| **Blind / Low-Vision** | **Spoken** (TTS Read-Aloud) | **Spoken** (Voice-to-Text) | Eyes-free, screen-reader optimized navigation |
| **Non-Verbal** | **Written** (Text & Visual Cues) | **Hand-Signed** (ASL Webcam Signs) | Hands-only communication without vocal input |
| **Deaf / Hard-of-Hearing** | **Hand-Signed** (Visual ASL Guide) | **Written** (Keyboard / Typing) | Audio-free interaction with visual sign language cues |
| **Limited Motor Mobility** | **Spoken** (TTS Prompts) | **Spoken** (Hands-Free Voice STT) | Hands-free input without physical keyboard typing |

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: Vanilla JavaScript (ES Modules), Semantic HTML5, WCAG 2.1 AA Compliant CSS Design System
- **Computer Vision & Landmark Tracking**: [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)
- **Speech Synthesis & Recognition**: Web Speech API (`SpeechSynthesis`, `SpeechRecognition`)
- **Cloud Database & Profile Layer**: [Supabase](https://supabase.com/) (`user_profiles`, `form_submissions`, `trained_signs`)
- **Build Tool & Dev Server**: [Vite](https://vitejs.dev/)
- **Hosting & Deployment**: [Vercel](https://vercel.com/)

```
/
├── index.html              — Semantic HTML layout, modals, kiosk auth & ARIA live regions
├── styles.css              — WCAG-compliant design system, high-contrast & focus styles
├── src/
│   ├── main.js             — App lifecycle, form builder wizard, kiosk profile UI & navigation
│   ├── recognition.js      — MediaPipe tracking, landmark normalization, 1-NN & gesture navigation
│   ├── speech.js           — Web Speech API (TTS/STT), persona-switching & voice commands
│   ├── train.js            — ASL gesture dataset manager, sample recorder & atomic cloud sync
│   ├── supabase-client.js  — Supabase data & kiosk authentication layer
│   └── asl-signs.js        — Visual ASL fingerspelling sign dictionary
├── package.json            — Project scripts and dependencies
├── vite.config.js          — Vite build configuration
├── vercel.json             — Vercel build & deployment settings
└── .env.example            — Environment variables template
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/Techint-ops/Intelliforms.git
   cd Intelliforms
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   ```bash
   cp .env.example .env
   ```
   Add your Supabase credentials in `.env`:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. Run local development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

---

---

## 🧠 AI & Machine Learning Pipeline

Intelliform leverages a multi-stage **Client-Side AI & Neural Computing Pipeline** to enable real-time, low-latency accessibility interactions:

```
                                 ┌──────────────────────────────────────────────────────────┐
                                 │                   LIVE WEBCAM INPUT                      │
                                 └────────────────────────────┬─────────────────────────────┘
                                                              │
                                                              ▼
                                 ┌──────────────────────────────────────────────────────────┐
                                 │       MediaPipe Deep Neural Network (DNN Inference)      │
                                 │   - BlazePalm Detector (Single-Shot Multibox SSD)        │
                                 │   - 21 3D Anatomical Landmark Regressor (63 Coordinates) │
                                 └────────────────────────────┬─────────────────────────────┘
                                                              │
                                                              ▼
                                 ┌──────────────────────────────────────────────────────────┐
                                 │        42-Dimensional Vector Normalization Engine        │
                                 │   - Wrist translation centering: (X - X_wrist)           │
                                 │   - Scale invariance via Palm Span normalization         │
                                 └────────────────────────────┬─────────────────────────────┘
                                                              │
                                                              ▼
                                 ┌──────────────────────────────────────────────────────────┐
                                 │           1-NN Metric Space Classifier & Voting          │
                                 │   - Real-time Euclidean distance embedding matching      │
                                 │   - Majority vote temporal buffer & hold-to-append filter│
                                 └──────────────────────────────────────────────────────────┘
```

### 1. 👁️ Computer Vision & Hand Landmark Regressor
- **Architecture**: Employs Google's **MediaPipe Hands** deep convolutional network running real-time ML inference directly inside the browser using WebGL GPU acceleration.
- **Keypoint Extraction**: Detects and tracks 21 volumetric 3D hand landmarks per frame with sub-pixel precision.

### 2. 📐 Metric Learning & 42-D Vector Embeddings
- **Translation Invariance**: Translates all coordinates relative to landmark `0` (Wrist):
  $$X'_i = X_i - X_{\text{wrist}}, \quad Y'_i = Y_i - Y_{\text{wrist}}$$
- **Scale Invariance**: Normalizes coordinate vectors by palm span distance ($\|P_{\text{index\_mcp}} - P_{\text{wrist}}\|$), allowing users to sign from any distance from the camera.

### 3. 🎯 Real-Time 1-NN Gesture Classification & Navigation
- **Euclidean Metric Embedding**: Compares live 42D vectors against personal/cloud calibration centroids using Euclidean distance:
  $$D(\vec{u}, \vec{v}) = \sqrt{\sum_{i=1}^{42} (u_i - v_i)^2}$$
- **Gesture Navigation**: Real-time heuristic state machine detects hands-free control gestures (**Thumbs-Up 👍 $\to$ Next Field**, **Thumbs-Down 👎 $\to$ Previous Field**).

### 4. 🎙️ Acoustic Neural Speech Recognition & Intent Parsing
- **Speech-to-Text (STT)**: Neural acoustic waveform transcription for hands-free voice input.
- **Intent Extraction**: Rule-based intent parser separates form answers from conversational voice navigation triggers (`"next"`, `"finish"`, `"previous"`).
- **Neural Text-to-Speech (TTS)**: Synthesizes high-clarity auditory prompts with natural prosody for visually impaired users.

### 5. 🔄 Adaptive Multimodal Transduction
- Dynamically translates between human communication modalities:
  $$\text{Sign Gestures (CV)} \longleftrightarrow \text{Text (NLP)} \longleftrightarrow \text{Voice (Acoustic)}$$

---

## 📦 Building for Production

```bash
npm run build
```
Production assets are generated in the `dist/` directory.

---

## 🔒 Security & Privacy

- **100% Local Video & Audio Processing**: Camera and microphone streams are processed client-side in the browser in real-time. No video feeds or raw audio recordings are ever uploaded or stored on servers.
- **Client Resilience**: Complete offline functionality via `localStorage` if network connectivity drops.
- **Row-Level Security**: Cloud database access is guarded through Supabase RLS policies.

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
