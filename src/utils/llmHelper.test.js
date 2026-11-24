import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseAiResponse, categorizeMessage, isTooShort } from './llmHelper'

const reply = fields => JSON.stringify({
  category: 'Technical Problem',
  categoryReasoning: 'Something is broken.',
  urgency: 'High',
  urgencyReasoning: 'Customers are blocked.',
  confidence: 'High',
  sentiment: 'Frustrated',
  productArea: 'Checkout',
  language: 'English',
  recommendedAction: 'Page on-call.',
  suggestedReply: 'Sorry, we are on it.',
  ...fields,
})

describe('parseAiResponse', () => {
  it('reads a complete JSON reply', () => {
    const result = parseAiResponse(reply(), 'Checkout is broken for everyone')
    expect(result).toMatchObject({
      category: 'Technical Problem',
      urgency: 'High',
      confidence: 'High',
      sentiment: 'Frustrated',
      productArea: 'Checkout',
      recommendedAction: 'Page on-call.',
      suggestedReply: 'Sorry, we are on it.',
    })
  })

  it('tolerates code fences and extra text', () => {
    const result = parseAiResponse('Here you go:\n```json\n' + reply() + '\n```', 'Checkout is broken for everyone')
    expect(result.category).toBe('Technical Problem')
  })

  it('returns null for a reply that is not JSON', () => {
    expect(parseAiResponse('Category: Billing', 'hello there friend')).toBeNull()
  })

  it('fills an invalid category from keyword rules and lowers confidence', () => {
    const result = parseAiResponse(reply({ category: 'Weather' }), 'My payment failed and I was double charged')
    expect(result.category).toBe('Billing Issue')
    expect(result.confidence).toBe('Low')
  })

  it('accepts a shortened category name', () => {
    expect(parseAiResponse(reply({ category: 'billing' }), 'Question about my invoice please').category).toBe('Billing Issue')
  })

  it('files plan changes as billing even when the model says feature request', () => {
    const result = parseAiResponse(reply({ category: 'Feature Request', urgency: 'Low' }), 'Can I upgrade my subscription to the pro plan?')
    expect(result.category).toBe('Billing Issue')
    expect(result.urgency).toBe('Low')
  })

  it('does not force "upgrade the editor" into billing', () => {
    const result = parseAiResponse(reply({ category: 'Feature Request', urgency: 'Low' }), 'Please upgrade the editor to support markdown')
    expect(result.category).toBe('Feature Request')
  })

  it('marks very short messages as low confidence', () => {
    expect(isTooShort('hi')).toBe(true)
    expect(isTooShort('server down now')).toBe(false)
    expect(parseAiResponse(reply({ category: 'General Inquiry', urgency: 'Low' }), 'hi').confidence).toBe('Low')
  })

  it('uses custom category names', () => {
    const result = parseAiResponse(reply({ category: 'Account Access' }), 'I am locked out of my account', {
      categoryNames: ['Billing Issue', 'Account Access'],
    })
    expect(result.category).toBe('Account Access')
  })
})

describe('categorizeMessage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('falls back to keyword rules with a reason when the server has no key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'missing_key' }), { status: 503 })))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await categorizeMessage('Our production server is down')
    expect(result).toMatchObject({ usedFallback: true, fallbackReason: 'missing_key', category: 'Technical Problem', urgency: 'High' })
  })

  it('falls back when the endpoint cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    const result = await categorizeMessage('Can I upgrade my plan?')
    expect(result).toMatchObject({ usedFallback: true, fallbackReason: 'network' })
  })

  it('retries once when rate limited', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: reply(), model: 'm' })))
    vi.stubGlobal('fetch', fetch)
    const result = await categorizeMessage('Checkout is broken for everyone', { retryDelay: 1 })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(result.usedFallback).toBe(false)
  })

  it('returns the parsed AI answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ content: reply(), model: 'test-model' }))))
    const result = await categorizeMessage('Checkout is broken for everyone')
    expect(result).toMatchObject({ usedFallback: false, category: 'Technical Problem', model: 'test-model' })
  })
})
