from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from langchain_openai import ChatOpenAI
from app.config import settings

# Primary — Gemini 2.5 Flash
primary_llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    api_key=settings.GEMINI_API_KEY,
    max_retries=1,
)

# Backup — Groq Llama 3.3 70B (fastest)
groq_llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=settings.GROQ_API_KEY,
    max_retries=1,
)

# Third — Nex-N2-Pro via OpenRouter (free, 262K context, built for agents)
nex_llm = ChatOpenAI(
    model="nex-agi/nex-n2-pro:free",
    api_key=settings.OPENROUTER_API_KEY,
    base_url="https://openrouter.ai/api/v1",
    max_retries=1,
)

# Chain: Gemini → Groq → Nex-N2-Pro
llm = primary_llm.with_fallbacks([groq_llm, nex_llm])
