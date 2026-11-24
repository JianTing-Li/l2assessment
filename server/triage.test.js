import { describe, it, expect, vi } from 'vitest'
import { runTriage, sendAlert, sanitizeCategories, buildSystemPrompt, DEFAULT_MODEL } from './triage.js'

const ok = body => vi.fn(async () => new Response(JSON.stringify(body), { status: 200 }))
const status = code => vi.fn(async () => new Response('{}', { status: code }))

describe('runTriage', () => {
  it('rejects empty and oversized messages', async () => {
    expect((await runTriage({ message: '  ' }, { GROQ_API_KEY: 'k' })).body.error).toBe('empty_message')
    expect((await runTriage({ message: 'x'.repeat(5001) }, { GROQ_API_KEY: 'k' })).body.error).toBe('message_too_long')
  })

  it('reports a missing key without calling Groq', async () => {
    const fetch = vi.fn()
    const result = await runTriage({ message: 'hi there' }, {}, fetch)
    expect(result).toEqual({ status: 503, body: { error: 'missing_key' } })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('maps Groq errors to clear codes', async () => {
    const env = { GROQ_API_KEY: 'k' }
    expect((await runTriage({ message: 'a b c' }, env, status(401))).body.error).toBe('invalid_key')
    expect((await runTriage({ message: 'a b c' }, env, status(404))).body.error).toBe('model_unavailable')
    expect((await runTriage({ message: 'a b c' }, env, status(429))).body.error).toBe('rate_limited')
    expect((await runTriage({ message: 'a b c' }, env, status(500))).body.error).toBe('ai_error')
    expect((await runTriage({ message: 'a b c' }, env, vi.fn(async () => { throw new Error('down') }))).body.error).toBe('ai_unreachable')
  })

  it('sends the key server-side, asks for JSON and returns the content', async () => {
    const fetch = ok({ choices: [{ message: { content: '{"category":"Billing Issue"}' } }] })
    const result = await runTriage({ message: 'refund please now', examples: [{ message: 'x', category: 'Billing Issue', urgency: 'Low' }] }, { GROQ_API_KEY: 'secret' }, fetch)
    expect(result).toEqual({ status: 200, body: { content: '{"category":"Billing Issue"}', model: DEFAULT_MODEL } })

    const [, init] = fetch.mock.calls[0]
    expect(init.headers.Authorization).toBe('Bearer secret')
    const body = JSON.parse(init.body)
    expect(body.response_format).toEqual({ type: 'json_object' })
    expect(body.messages[0].content).toContain('The support team corrected these earlier messages')
    expect(body.messages[1].content).toContain('refund please now')
  })

  it('honours GROQ_MODEL', async () => {
    const fetch = ok({ choices: [{ message: { content: '{}' } }] })
    await runTriage({ message: 'a b c' }, { GROQ_API_KEY: 'k', GROQ_MODEL: 'qwen/test' }, fetch)
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.model).toBe('qwen/test')
    expect(body.reasoning_effort).toBeUndefined()
  })
})

describe('prompt', () => {
  it('uses client categories but drops bad ones', () => {
    const categories = sanitizeCategories([{ name: 'Account Access', description: 'logins' }, { name: '' }, null])
    expect(categories).toEqual([{ name: 'Account Access', description: 'logins' }])
    expect(buildSystemPrompt(categories)).toContain('- Account Access: logins')
    expect(sanitizeCategories('nope').length).toBe(5)
  })
})

describe('sendAlert', () => {
  it('does nothing without a webhook', async () => {
    const fetch = vi.fn()
    expect((await sendAlert({ message: 'x', category: 'y' }, {}, fetch)).status).toBe(204)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('posts a Slack message when configured', async () => {
    const fetch = ok({})
    const result = await sendAlert(
      { message: 'Server down', category: 'Technical Problem', urgency: 'High', routeTo: 'Technical support' },
      { SLACK_WEBHOOK_URL: 'https://hooks.slack.test/abc' },
      fetch
    )
    expect(result.status).toBe(200)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://hooks.slack.test/abc')
    expect(JSON.parse(init.body).text).toContain('Technical Problem* → Technical support')
  })
})
