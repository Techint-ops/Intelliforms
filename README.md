# Intelliform

> **AI-Enabled Digital Accessibility Platform**  
> Empowering users with diverse physical, sensory, and cognitive abilities to fill out digital forms seamlessly through multi-modal inputs (Voice/Speech, ASL Hand Signs, Audio Prompts, and Keyboard).

---

## 🌟 Overview

**Intelliform** is a web-based, multi-modal accessible form-filling platform. It bridges accessibility gaps by adapting both **how form fields are presented** to the user and **how answers can be provided**:

- **Spoken (Audio / TTS)**: Screen reader prompts read aloud via the Web Speech API.
- **Voice (STT)**: Hands-free voice-to-text response capture with built-in voice navigation commands (`"next"`, `"finish"`, `"submit"`).
- **Hand-Signed (Vision / ASL)**: Real-time American Sign Language recognition using webcam hand landmark detection via MediaPipe.
- **Written (Text / Keyboard)**: Traditional high-contrast accessible visual text and keyboard inputs.

---

## ♿ Accessibility Personas

| Persona | Recommended Field Input | Recommended Response Mode | Target User Need |
| :--- | :--- | :--- | :--- |
| **Blind / Low-vision** | Spoken (TTS Read-Aloud) | Spoken (Voice-to-Text) | Eyes-free, screen-reader optimized navigation |
| **Non-verbal** | Written (Text Display) | Signed (ASL Webcam Signs) | Voice-free input via hand gestures |
| **Deaf / Hard-of-hearing** | Signed (Visual ASL Cues) | Written (Typing / Text) | Audio-free interaction with visual sign guides |
| **Limited-motor** | Spoken (TTS Prompts) | Spoken (Voice-to-Text) | Hands-free input without physical typing |

---

## 🛠️ Architecture & Tech Stack

- **Frontend**: Vanilla JavaScript (ES Modules), HTML5, Custom CSS Design System
- **Build Tool & Dev Server**: [Vite](https://vitejs.dev/)
- **Computer Vision & Landmark Tracking**: [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)
- **Speech Synthesis & Recognition**: Web Speech API (`SpeechSynthesis`, `SpeechRecognition`)
- **Cloud Database & Sync**: [Supabase](https://supabase.com/) (`form_submissions`, `trained_signs`)
- **Deployment**: [Vercel](https://vercel.com/)

```
/
├── index.html              — Semantic HTML structure and module entry
├── styles.css              — WCAG-compliant design system, high-contrast & focus styles
├── src/
│   ├── main.js             — App lifecycle, form builder wizard, modals & navigation
│   ├── recognition.js      — MediaPipe tracking, landmark normalization & kNN classifier
│   ├── speech.js           — Web Speech API (TTS/STT), persona-switching & voice commands
│   ├── train.js            — ASL gesture dataset manager, sample recorder & cloud sync
│   ├── supabase-client.js  — Supabase data layer (submissions & trained signs)
│   └── asl-signs.js        — Visual ASL sign dictionary
├── package.json            — Project scripts and dependencies
├── vite.config.js          — Vite configuration
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
   Fill in your Supabase credentials in `.env`:
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

## 📦 Building for Production

```bash
npm run build
```
Production assets are generated in the `dist/` directory.

---

## 🔒 Security & Privacy

- Camera and microphone streams are processed **100% locally in the browser** in real-time. Video and audio streams are never uploaded or stored on servers.
- Supabase credentials use public anonymous keys restricted via Row-Level Security (RLS).

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
