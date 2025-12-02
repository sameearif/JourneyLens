# JourneyLens 🔮

<p align="center">
  <img src="public/logo.png" alt="JourneyLens Logo" width="120"/>
</p>

<p align="center">
  <strong>An AI-Powered Future Self Visualization & Goal Achievement Platform</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#demo">Demo</a> •
  <a href="#installation">Installation</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#research">Research</a> •
  <a href="#license">License</a>
</p>

---

## Overview

**JourneyLens** is a multimodal AI application designed to help graduate students (and anyone navigating uncertainty) bridge the gap between their long-term aspirations and daily actions. Unlike traditional goal-tracking apps, JourneyLens combines:

- 🎯 **Conversational Vision Calibration** — AI-guided discovery of your values and goals
- 🖼️ **Generative Visual Avatars** — AI-created images of your "Future Self"
- 📖 **Living Story Engine** — Your journey narrated as an evolving motivational story
- ✅ **Smart Goal Decomposition** — Abstract visions broken into actionable todos
- 💬 **Context-Aware Advice** — Personalized guidance based on your journals and goals

> *"The AI completes my story with a positive note that describes how I overcame that challenge and move on towards achieving my goal in concrete next steps. That felt especially inspiring."* — Study Participant

---

## Features

### 🧭 Phase 1: Calibrate (VisionCraft Chat)
A 10-question conversational intake with an AI persona called **VisionCraft** that discovers:
- What you want to achieve and why it matters
- Short-term and long-term milestones
- Your "Future Self" character design (for image generation)
- Emotional tone and themes for your narrative

**Supports voice input (ASR) and voice output (TTS) for accessibility.**

### 🌟 Phase 2: Envision (Vision Dashboard)
After calibration, the system generates:
- **Vision Statement**: Title + detailed description
- **AI Avatar**: A FLUX.1-generated image of your future self
- **First Story Chapter**: The beginning of your motivational narrative

### 📋 Phase 3: Act (Goal Management)
- **Long-Term Todos**: Major milestones toward your vision
- **Short-Term Todos**: Actionable steps for the coming days/weeks
- Editable, checkable, and persistable to your account

### 📓 Phase 4: Reflect & Adapt (Journals + Living Story)
The core innovation:
1. **Write a journal entry** about your day, struggles, or wins
2. **AI generates the next story chapter** incorporating your real experiences
3. **New illustration created** for each chapter, maintaining character consistency
4. **Running summaries** keep the narrative coherent over time

### 💡 Advice Chat
Ask for guidance anytime. The AI reads your entire context:
- Vision description
- All todos (checked and unchecked)
- Journal history and summaries
- Latest journal entry

...to provide specific, empathetic, actionable advice.

---

## Demo

<p align="center">
  <img src="results/plots_v2/rq1_comprehensive.png" alt="RQ1 Results" width="80%"/>
</p>

<p align="center"><em>User study results showing improved future self clarity after using JourneyLens</em></p>

---

## Installation

### Prerequisites
- Node.js 18+ 
- PostgreSQL 14+
- Together AI API key (for LLM and image generation)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/journeylens.git
cd journeylens
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Create a `.env.local` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/journeylens

# Together AI (for LLM + Image Generation)
TOGETHER_API_KEY=your_together_ai_api_key

# Optional: For TTS/ASR if using external services
# OPENAI_API_KEY=your_openai_key
```

### 4. Initialize the Database
```bash
psql -U your_user -d journeylens -f database/create_database.sql
```

Or connect to your PostgreSQL instance and run:
```sql
-- See database/create_database.sql for full schema
CREATE TABLE users (...);
CREATE TABLE visions (...);
CREATE TABLE stories (...);
CREATE TABLE journals (...);
```

### 5. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Architecture

```
JourneyLens/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── (auth)/             # Login/Signup
│   │   ├── calibrate/          # Vision calibration entry
│   │   ├── chat/               # VisionCraft chat interface
│   │   ├── visions/            # Vision dashboard & details
│   │   ├── journals/           # Journal writing interface
│   │   ├── stories/            # Story chapter viewer
│   │   ├── advice/             # Advice chat interface
│   │   └── api/                # API routes
│   │       ├── auth/           # Authentication endpoints
│   │       ├── chat/           # LLM chat + summary + story
│   │       ├── visions/        # CRUD for visions
│   │       ├── journals/       # Journal + story generation
│   │       ├── stories/        # Story management
│   │       ├── vision-image/   # Image generation
│   │       ├── tts/            # Text-to-speech
│   │       └── asr/            # Speech-to-text
│   ├── components/             # Reusable UI components
│   └── lib/                    # Utilities
│       ├── db.js               # PostgreSQL connection
│       ├── llm.js              # Together AI LLM client
│       ├── tti.js              # Text-to-image (FLUX.1)
│       ├── tts.js              # Text-to-speech
│       ├── asr.js              # Automatic speech recognition
│       └── prompts.js          # System prompts for AI
├── database/
│   └── create_database.sql     # Database schema
├── public/                     # Static assets
└── results/                    # User study analysis
```

### Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16, React 19, Lucide Icons |
| **Backend** | Next.js API Routes (App Router) |
| **Database** | PostgreSQL with `pg` driver |
| **LLM** | Together AI (Llama-3.3-70B-Instruct-Turbo) |
| **Image Gen** | Together AI (FLUX.1-schnell, FLUX.1-kontext-dev) |
| **Voice** | Custom ASR/TTS implementation |

### Database Schema

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   users     │       │   visions   │       │   stories   │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ user_id (PK)│◄──────│ user_id (FK)│       │ story_id(PK)│
│ username    │       │ vision_id(PK)│◄──────│ vision_id(FK)│
│ fullname    │       │ title       │       │ story_text  │
│ password    │       │ description │       │ story_images│
│ created_at  │       │ char_desc   │       │ created_at  │
└─────────────┘       │ image_url   │       └─────────────┘
                      │ todos (JSON)│
                      │ chat_history│       ┌─────────────┐
                      │ summaries   │       │  journals   │
                      │ created_at  │       ├─────────────┤
                      └─────────────┘       │ journal_id  │
                            ▲               │ vision_id(FK)│
                            └───────────────│ entry_date  │
                                            │ journal_text│
                                            │ created_at  │
                                            └─────────────┘
```

---

## Research

JourneyLens was developed as part of a Human-AI Interaction research project. We conducted a user study with 5 graduate students over 3 days to evaluate:

### Research Questions

1. **RQ1**: Does the tool enhance perceived clarity and vividness of future selves?
2. **RQ2**: Does it influence motivation and self-efficacy?
3. **RQ3**: How does it facilitate translating values into concrete goals?

### Key Findings

| Metric | Pre→Post Change | Effect Size |
|--------|-----------------|-------------|
| Future Self Continuity | +1.55 | **Large** (d=1.50) |
| Typical Day Imagination | +1.00 | **Large** (d=1.41) |
| Problem-Solving Confidence | +1.00 | Medium (d=0.71) |
| Persistence | +0.60 | Medium (d=0.53) |

**Qualitative themes:**
- ✅ Goal decomposition helped make visions actionable
- ✅ Narrative scaffolding created emotional connection
- ⚠️ Image generation speed needs improvement
- ⚠️ Personalization gaps in generated content

See `results/evaluation_report.tex` for the full analysis.

---

## API Reference

### Authentication
```
POST /api/auth/signup    # Create account
POST /api/auth/login     # Login
```

### Visions
```
GET  /api/visions?userId=X         # List user's visions
GET  /api/visions?visionId=X       # Get single vision
POST /api/visions                  # Create vision
PUT  /api/visions                  # Update vision
DELETE /api/visions                # Delete vision
```

### Chat & AI
```
POST /api/chat           # General chat with VisionCraft
POST /api/chat/summary   # Generate vision summary from chat
POST /api/chat/story     # Generate story chapter
```

### Journals & Stories
```
GET  /api/journals?visionId=X      # List journal entries
POST /api/journals                 # Create entry (triggers story gen)
GET  /api/stories?visionId=X       # List story chapters
PUT  /api/stories                  # Update story image
```

### Media Generation
```
POST /api/vision-image   # Generate image from prompt
POST /api/tts            # Text-to-speech
POST /api/asr            # Speech-to-text
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `TOGETHER_API_KEY` | Yes | Together AI API key for LLM + images |
| `TOGETHER_AI_API` | Alt | Alternative env var name for Together AI |

---

## Development

### Running Locally
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Running User Study Analysis
```bash
cd results
python3 analysis_v2.py   # Generate plots and statistics
```

---

## Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## Citation

If you use JourneyLens in your research, please cite:

```bibtex
@misc{journeylens2024,
  title={JourneyLens: An AI-Powered Future Self Visualization Platform},
  author={[Your Names]},
  year={2024},
  howpublished={GitHub Repository},
  url={https://github.com/yourusername/journeylens}
}
```

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- **Together AI** for LLM and image generation APIs
- **Black Forest Labs** for FLUX.1 image models
- **Meta AI** for Llama 3.3 language model
- Study participants who provided valuable feedback
- CSE 594: Human-AI Interaction course staff

---

<p align="center">
  Made with ❤️ for graduate students navigating uncertainty
</p>

<p align="center">
  <a href="#journeylens-">Back to Top</a>
</p>
