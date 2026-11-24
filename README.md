# Relay AI: Customer Inbox Triage

Paste a customer support message, or a whole batch, and get:

- **Category** (Billing Issue, Technical Problem, Feature Request, General Inquiry, Positive Feedback, or your own)
- **Urgency** (High / Medium / Low) with the reason
- **Team to route it to** and a **recommended next step**
- A **draft reply** to send the customer
- **Confidence**, a **needs review** flag, **sentiment**, **product area**, **language**, and any **order or invoice IDs** in the message

Results land in a **queue** where agents set a status (Open, In progress, Resolved), search and filter, and **correct** the category or urgency. Corrections are sent back to the AI as examples, and the dashboard shows how often agents keep the AI's answer.

## Tech stack

- React 19 + Vite + Tailwind CSS
- Groq API (`openai/gpt-oss-20b` by default), called from a server endpoint so the API key never reaches the browser
- Vercel serverless functions in `api/`; the Vite dev server serves the same routes locally
- Vitest for tests; data stays in the browser's localStorage

## Setup

You need Node.js 20+ and a free Groq API key from [console.groq.com/keys](https://console.groq.com/keys) (no credit card).

```bash
npm install
```

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
GROQ_API_KEY=gsk_your-key-here
```

```bash
npm run dev
```

Open http://localhost:5173. Without a key the app still works: it falls back to keyword rules and says why on each result.

### Optional settings (`.env.local` or Vercel project settings)

| Variable | What it does |
|---|---|
| `GROQ_MODEL` | Use a different Groq model. Groq retires models often; pick one your account lists at console.groq.com. |
| `SLACK_WEBHOOK_URL` | Post High-urgency messages to a Slack channel ([Incoming Webhook](https://api.slack.com/messaging/webhooks)). Can be turned off on the Settings page. |

The older `VITE_GROQ_API_KEY` name still works, but rename it to `GROQ_API_KEY`.

## Deploying

The repo is ready for Vercel: import it, add `GROQ_API_KEY` as an environment variable, and deploy. `api/triage.js` and `api/alert.js` become serverless functions, and `vercel.json` sends every other path to the React app.

Note that `/api/triage` is public once deployed, so anyone who finds it can use your Groq quota. Add authentication or rate limiting before sharing it widely.

## How it works

```
Browser                                   Server (api/ on Vercel, vite.config.js locally)
───────                                   ──────
AnalyzePage ─ triage.js ─ llmHelper.js ──► POST /api/triage ── server/triage.js ──► Groq (JSON mode)
                  │            │                                    builds the prompt from your categories
                  │            └─ parseAiResponse: validates every     and recent agent corrections
                  │               field, fills gaps from keyword rules
                  │
                  ├─ keywordRules.js + urgencyScorer.js   offline fallback and business rules
                  ├─ extract.js                           reference IDs, batch/CSV parsing
                  └─ storage.js                           history in localStorage (last 500)
```

- **One AI call per message** returns every field as JSON. Anything missing or invalid is filled from the keyword rules, and the result is marked low confidence.
- **Business rules on top of the AI**: plan changes (upgrade, downgrade, cancel a plan) are always Billing, and messages under three words are always low confidence.
- **Urgency depends on impact** (outage, lost connection, locked out, data loss, security, payment failure, double charge), not on punctuation, length or time of day.
- **Fallback**: if the AI is unavailable (no key, bad key, rate limit, retired model, network), keyword rules produce the category, urgency and action, and the result says why. Rate limits get one retry first.
- **Batches** run three messages at a time, up to 50 per batch.

## Pages

| Page | What it's for |
|---|---|
| Home | Today's numbers, the open queue, recent activity |
| Analyze | One message or a batch (paste, or upload a CSV/text file) |
| Queue | Status, search, filters, sorting, corrections, draft replies |
| Dashboard | Volume per day by urgency, category mix, AI accuracy, insights, CSV export |
| Settings | Category descriptions sent to the AI, teams, actions, custom categories, Slack alerts |

## Tests

```bash
npm test
```

Unit tests cover the keyword rules (against every message in `sample-messages.json`), AI reply parsing, fallback handling, CSV and batch parsing, storage, settings, corrections, stats and the server endpoint.

```bash
npm run eval
```

Runs `sample-messages.json` through the live model and compares it with the expected category and urgency. Use it after changing the prompt or the model.

## Troubleshooting

| Banner says | Fix |
|---|---|
| No Groq API key is set | Add `GROQ_API_KEY` to `.env.local` and restart `npm run dev` |
| The Groq API key was rejected | Make a new key at console.groq.com/keys |
| The configured Groq model is not available | Set `GROQ_MODEL` to a model your account lists |
| Rate limit was hit | Wait a minute; the free tier limits requests per minute |
| Could not reach /api/triage | Run the app with `npm run dev` or `npm run preview`, not by opening `dist/index.html` |

## License

For educational purposes only.
