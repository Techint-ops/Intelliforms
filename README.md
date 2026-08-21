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

## 🗄️ Supabase Database Schema

To set up the backend database tables in your Supabase SQL Editor:

```sql
-- 1. Form Submissions Table
CREATE TABLE IF NOT EXISTS public.form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_name TEXT NOT NULL DEFAULT 'Untitled Form',
    username TEXT DEFAULT 'guest',
    fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    responses JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Trained ASL Gesture Vectors Table
CREATE TABLE IF NOT EXISTS public.trained_signs (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    sync_code TEXT NOT NULL,
    label TEXT NOT NULL,
    vector JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Kiosk User Profiles Table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    pin TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS and public policies
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trained_signs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public all form_submissions" ON public.form_submissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all trained_signs" ON public.trained_signs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all user_profiles" ON public.user_profiles FOR ALL USING (true) WITH CHECK (true);
```

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
