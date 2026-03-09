# 🛰️ SatLoom

> Secure, Anonymous, Real-time Communication

SatLoom is a privacy-first, real-time communication web app built with Next.js and Firebase. Create or join rooms instantly — no login required. All messages are encrypted, and rooms can be password-protected for extra security.

---

## ✨ Features

### 💬 Communication
- **Real-time Chat** — Encrypted messaging with replies, reactions, polls, and events
- **Audio & Video Calls** — WebRTC-powered peer-to-peer calls
- **Screen Share** — Share your screen during video calls
- **Knock Knock** — Gentle call notifications before connecting
- **Vanish Mode** — Self-destructing messages with configurable timers

### 🎮 Games & Entertainment
- **Game Center** — Chess, Connect Four, Tic Tac Toe, Dots & Boxes
- **Mafia/Werewolf** — Classic social deduction game
- **Buzzword Bingo** — Interactive bingo with custom words
- **Trivia Quiz** — Real-time multiplayer quizzes

### 🎬 Media & Watch Together
- **Movie Theater** — Synchronized video watching (YouTube, Vimeo, direct links)
- **Karaoke** — Sing along with friends
- **Soundboard** — Fun sound effects for the room
- **Audio Emoji** — Sound-based emoji reactions
- **Ambient Sounds** — Background audio atmospheres

### 🛠️ Productivity
- **Whiteboard** — Collaborative drawing canvas
- **Shared Notes** — Real-time collaborative note-taking
- **Task List** — Shared to-do lists
- **Presentations** — Present slides to the room

### 🔒 Security & Privacy
- **No Login Required** — Fully anonymous usage
- **End-to-End Encryption** — Messages encrypted with room-derived keys
- **Password Protection** — Optional room passwords
- **Privacy Shield** — Screenshot prevention & console blocking
- **Burner Links** — One-time-use invite links

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- A [Firebase](https://console.firebase.google.com/) project with **Realtime Database** enabled

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/satloom.git
   cd satloom
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   ```bash
   cp .env.example .env.local
   ```
   Edit `.env.local` and add your Firebase credentials. See the file for detailed instructions.

4. **Set Firebase Database Rules**

   Copy the rules from `firebase-rules.json` into your Firebase Console → Realtime Database → Rules.

5. **Run the development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏗️ Tech Stack

| Layer | Technology |
|:------|:-----------|
| Framework | [Next.js 15](https://nextjs.org/) (React 19) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) |
| Backend | [Firebase Realtime Database](https://firebase.google.com/) |
| Calls | WebRTC (P2P) |
| State | [Zustand](https://docs.pmnd.rs/zustand) |
| UI | [Radix UI](https://www.radix-ui.com/) + [Lucide Icons](https://lucide.dev/) |
| Language | TypeScript |

---

## 📁 Project Structure

```
├── app/              # Next.js app router pages
├── components/       # React components
│   ├── chat/         # Chat interface (split into hooks & sub-components)
│   ├── games/        # Game board components
│   ├── ui/           # shadcn/ui components
│   └── ...           # Feature modals & panels
├── contexts/         # React context providers
├── hooks/            # Custom React hooks
├── lib/              # Firebase config & utilities
├── stores/           # Zustand stores
├── styles/           # Global CSS
├── utils/            # Utility modules (encryption, signaling, etc.)
└── public/           # Static assets
```

---

## 🔧 Environment Variables

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Description |
|:---------|:------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | Realtime Database URL |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |

---
