import { sendAlert } from '../server/triage.js'

// Vercel serverless function: POST /api/alert (posts to Slack when SLACK_WEBHOOK_URL is set)
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  const { status, body } = await sendAlert(req.body ?? {}, process.env)
  return res.status(status).json(body)
}
