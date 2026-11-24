/**
 * Run sample-messages.json through the live AI and compare with the expected
 * category and urgency. Needs GROQ_API_KEY in .env.local.
 *
 *   npm run eval
 */
import { readFileSync } from 'node:fs'
import { runTriage } from '../server/triage.js'

const { testMessages } = JSON.parse(readFileSync(new URL('../sample-messages.json', import.meta.url)))
let passed = 0
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

// Free-tier limits are per minute: space requests out and retry once on a 429
async function triage(message) {
  const result = await runTriage({ message }, process.env)
  if (result.status !== 429) return result
  await wait(30_000)
  return runTriage({ message }, process.env)
}

for (const sample of testMessages) {
  const { status, body } = await triage(sample.message)
  await wait(2_000)
  if (status !== 200) {
    console.log(`✗ #${sample.id} ${sample.title}: ${body.error}${body.detail ? ` (${body.detail})` : ''}`)
    continue
  }
  let reply = {}
  try {
    reply = JSON.parse(body.content)
  } catch {
    // counted as a miss below
  }
  const ok = reply.category === sample.expected.category && reply.urgency === sample.expected.urgency
  if (ok) passed++
  console.log(`${ok ? '✓' : '✗'} #${sample.id} ${sample.title}: ${reply.category ?? '?'} / ${reply.urgency ?? '?'}` +
    (ok ? '' : `   (expected ${sample.expected.category} / ${sample.expected.urgency})`))
}

console.log(`\n${passed}/${testMessages.length} match. Raw model output, before the app's business rules.`)
process.exitCode = passed === testMessages.length ? 0 : 1
