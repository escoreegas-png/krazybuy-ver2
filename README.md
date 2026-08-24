# KrazyBuy V1

## Flow
URL → job → upstream search → stream URL → complete SSE → product detection → exact variant filtering → store detection → dedupe → suspicious-price filtering → best available price → Retzo → clean result → UI.

## Run

```powershell
npm install
Copy-Item .env.example .env
# set GROQ_API_KEY in .env when you want the Groq Retzo path
npm start
```

Open `http://localhost:5174`.

## Files
- `backend/server.js` — full job backend and normalization engine
- `frontend/index.html` — workspace UI
- `frontend/style.css` — responsive design
- `frontend/app.js` — job/SSE client and result renderer
- `package.json` — Node setup
