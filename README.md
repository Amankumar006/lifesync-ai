# LifeSync AI 📅🤖

**LifeSync AI** is an adaptive, agentic daily schedule optimizer and personal assistant. Powered by **LangGraph** and **FastAPI**, it dynamically balances academic deadlines, professional work shifts, and flexible tasks around your non-negotiable personal routines (like meditation, workouts, and sleep). 

It is designed for students, freelancers, and working professionals who want to maintain high productivity without sacrificing daily habits and well-being.

---

## 🌟 Key Features

### 1. LangGraph State Graph Orchestration
- Uses a multi-agent state graph compiled with LangGraph to orchestrate **Intent Classification**, **Context Hydration**, **Dynamic Scheduling**, **Clarification Loops**, and **Human-in-the-Loop (HITL)** approvals.
- Incorporates session-level memory and cross-session persistence in a PostgreSQL memory store.

### 2. Smart Onboarding & On-the-Fly Discovery
- If any core information is missing (such as your college, routine habits, or timetable), the agent naturally prompts you with discovery questions during conversation.
- If you skip or reject a topic (e.g., saying "no"), the agent marks it complete and never asks you about it again.

### 3. Timetable Photo Upload & Parsing
- Upload a photo of your schedule directly from your phone. 
- The backend parses the image using Gemini's multimodal vision features to extract classes and timings, saving them directly to Firestore.

### 4. Dynamic VTU Syllabus & Calendar Fetching
- Provide your college name, branch, semester, and scheme (e.g., *RVCE, 5th Sem CSE, 2022 Scheme*).
- The system automatically triggers async tasks to scrape or fetch your college's academic calendar and downloads/extracts subjects and unit topics directly from the Visvesvaraya Technological University (VTU) syllabus database.

### 5. Rule-Based Academic & Routine Scheduling
Constructs daily schedules that automatically respect strict priority rules:
- **Habit Preservation**: Non-negotiable blocks (e.g., Meditation at 6:00 AM) are strictly protected and cannot collide with other tasks.
- **CIE Proximity Rules**: Automatically increases study prep slots as exams approach (2-hour daily slots $\le$ 7 days away; 3-hour critical study blocks $\le$ 3 days away).
- **Holidays & Calendar**: Automatically fetches VTU holidays (e.g., Yoga Day) and excludes college/heavy study expectations on those dates.
- **Saturday Movie Night**: Saturday night schedules dynamically check your genre preferences, search the TMDB API, and insert a movie recommendation block at 21:30.

### 6. Interactive Reminders & Notifications
- Approving a proposed schedule automatically logs it to Firestore and registers push reminder notifications for each schedule block.

---

## 🛠️ Technology Stack

* **Backend Engine**: FastAPI, Python 3.12, LangGraph, Uvicorn, APScheduler.
* **Database & Auth**: Firebase Admin SDK (Cloud Firestore), PostgreSQL (for LangGraph memory store).
* **AI Models**: Google Gemini 2.5 Flash, Groq Llama 3.3 70B (fast backup), Nex-N2-Pro via OpenRouter.
* **Mobile Client**: React Native, Expo SDK 55, TypeScript.

---

## 🏗️ Architecture

```mermaid
graph TD
    User([User Chat/Upload]) --> API[FastAPI Endpoint]
    API --> Classify[Classify Intent Node]
    
    Classify -- info_provided --> Save[Save User Info Node]
    Classify -- schedule_build --> Hydrate[Hydrate Context Node]
    Classify -- general --> GenChat[General Chat Node]
    
    Save --> Clarify[Check Clarification Node]
    GenChat --> Clarify
    
    Hydrate --> Build[Build Schedule Node]
    Build --> Clarify
    
    Clarify -- Gaps Found --> PromptQuestion[Ask Discovery Question] --> END([End Turn])
    Clarify -- No Gaps & schedule_build --> Propose[Propose Schedule Node]
    
    Propose -- HITL Interrupted --> AppUser([User Approval API])
    AppUser -- Approved --> Commit[Commit Schedule Node]
    Commit --> END
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.12+
- Node.js 18+ & npm
- PostgreSQL database
- Firebase Project setup

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a python virtual environment:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Place your Firebase Service Account JSON credentials key in the root backend folder and name it `firebase-service-account.json`.
5. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```
6. Populate the `.env` variables with your API keys:
   ```env
   GEMINI_API_KEY=your_gemini_key
   GROQ_API_KEY=your_groq_key
   TMDB_API_KEY=your_tmdb_key
   DB_URI=postgresql+asyncpg://user:pass@localhost:5432/dbname
   ```
7. Start the Uvicorn reloading server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

### 3. Mobile Setup
1. Navigate to the mobile directory:
   ```bash
   cd ../mobile
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Add your `google-services.json` to the mobile root folder.
4. Configure your backend URL in `.env`:
   ```env
   EXPO_PUBLIC_BACKEND_URL=http://your_local_ip:8000
   ```
5. Start the Expo development server:
   ```bash
   npx expo start
   ```

---

## 🧪 Running Tests

To execute the E2E test suite:
```bash
cd backend
source .venv/bin/activate
python "/Users/amankumar/.gemini/antigravity/brain/4a84db7c-714d-47d6-a444-96934d0527ee/scratch/test_phase5_e2e.py"
```
