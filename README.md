<div align="center">

# 🎯 PrepMate

**Your AI-Powered Interview Partner**

Practice interviews • Get instant feedback • Land your dream job

[![Live Demo](https://img.shields.io/badge/demo-live-success?style=for-the-badge)](https://prepmate-interview.vercel.app/)
[![CI](https://github.com/Sujal-tyagi17/prepmate/actions/workflows/ci.yml/badge.svg)](https://github.com/Sujal-tyagi17/prepmate/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

</div>

---

## 📸 Preview

### 🎬 Demo

<div align="center">
  <img src="./docs/demo/prepmate-demo.gif" alt="PrepMate demo: Maya, the AI interviewer, asking questions with live captions, a spoken answer, the code editor and the feedback report" width="100%"/>
  <p>▶️ <b><a href="./docs/demo/prepmate-demo.mp4">Watch the full 2½-minute walkthrough (MP4)</a></b><br/>
  Setup → AI interviewer with live captions → voice answers &amp; hands-free mode → coding question → feedback report → analytics</p>
</div>

<div align="center">
  <img src="./screenshots/hero.png" alt="PrepMate Landing Page" width="100%"/>
</div>

---

## ✨ Features

- 🤖 **AI-Powered Practice** - Realistic interview questions using Google Gemini AI
- 📊 **Instant Feedback** - Detailed analysis and improvement suggestions
- 📈 **Progress Tracking** - Monitor your improvement over time
- 🎯 **All Interview Types** - Technical, Behavioral, HR, System Design
- 💰 **100% Free** - No hidden costs, unlimited practice
- ⚡ **24/7 Available** - Practice anytime, anywhere

---

## 🚀 Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, Framer Motion
- **Backend:** Next.js API Routes, Supabase (PostgreSQL)
- **AI:** Google Gemini API, Groq API
- **Auth:** Clerk
- **Storage:** Vercel Blob, Cloudinary
- **Deployment:** Vercel

---

## 🛠️ Quick Start

1. **Clone the repo**
```bash
git clone https://github.com/Sujal-tyagi17/PrepMate.git
cd prepmate
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**

Create `.env.local`:
```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_key
CLERK_SECRET_KEY=your_secret
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

# AI APIs
GEMINI_API_KEY=your_key
GROQ_API_KEY=your_key

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Run development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 📁 Project Structure
```
prepmate/
├── app/                 # Next.js app directory
│   ├── (auth)/         # Authentication pages
│   ├── (dashboard)/    # Protected routes
│   └── api/            # API routes
├── components/          # React components
├── lib/                # Utilities (AI, DB, Storage)
├── public/             # Static assets
└── types/              # TypeScript types
```

---

## 🧪 Testing

End-to-end tests (Playwright) run the real Next.js app and API routes against an in-memory database and a local fake AI server, so they need no API keys or Supabase project.

```bash
npm run typecheck      # TypeScript
npm run test:e2e       # e2e suite (starts the app + fake AI automatically)
```

The suite covers the full interview lifecycle — start screen and session clock, intro → follow-ups → wrap-up, background scoring, reload/resume, skip, time-up, code answers, hands-free mode, scoring failures and retries, feedback and analytics consistency — on desktop and mobile viewports. It runs on every push and pull request via GitHub Actions (`.github/workflows/ci.yml`).

How it works: setting `E2E=1` makes `next.config.js` swap Clerk and Supabase for stand-ins in `tests/e2e/support/`, and `GROQ_BASE_URL` points the AI client at `tests/e2e/support/fake-ai-server.mjs`. Production builds never include these.

## 🚢 Deployment

Deploy to Vercel:

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com/)
3. Import your repository
4. Add environment variables
5. Deploy!

Or use Vercel CLI:
```bash
npm i -g vercel
vercel
```

---

## 🎯 Usage

1. **Sign Up** - Create account or sign in with Google/GitHub
2. **Choose Interview Type** - Technical, Behavioral, HR, or System Design
3. **Practice** - Answer AI-generated questions via voice or text
4. **Get Feedback** - Review detailed performance analysis
5. **Track Progress** - Monitor improvement over time
---

## 👤 Author

**Sujal Tyagi**

- GitHub: [@Sujal-tyagi17](https://github.com/Sujal-tyagi17)
- Email: tyagisujal007@gmail.com

---

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) for the amazing framework
- [Google Gemini](https://ai.google.dev/) for AI capabilities
- [Vercel](https://vercel.com/) for hosting
- [Clerk](https://clerk.com/) for authentication

---

<div align="center">

⭐ **Star this repo if you find it helpful!**

</div>