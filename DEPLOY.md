# KrazyBuy V5 deployment

1. Copy `.env.example` to `.env`.
2. Add your 7 Groq API keys to `GROQ_API_KEY_1` through `GROQ_API_KEY_7` (or use `GROQ_API_KEY` for the first slot).
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:5174` and check `http://localhost:5174/api/health`.

The backend uses one final Retz verdict request per job, with per-key rolling TPM accounting and key failover for retryable failures. Product matching, price safety, store identification, and verification classification are deterministic.

Do not commit `.env`.
