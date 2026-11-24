import { describe, it, expect } from 'vitest'
import samples from '../../sample-messages.json'
import { getKeywordAnalysis, PLAN_CHANGE, detectSentiment } from './keywordRules'
import { calculateUrgency } from './urgencyScorer'

describe('keyword fallback on sample messages', () => {
  for (const sample of samples.testMessages) {
    it(`#${sample.id} ${sample.title}`, () => {
      const result = getKeywordAnalysis(sample.message)
      const expectedCategory = sample.fallback?.category ?? sample.expected.category
      expect(result.category).toBe(expectedCategory)
      if (!sample.fallback) expect(result.urgency).toBe(sample.expected.urgency)
    })
  }
})

describe('PLAN_CHANGE', () => {
  it.each([
    'Can I upgrade my subscription to the pro plan?',
    'I want to cancel my account',
    "I'd like to upgrade to premium",
    'Please downgrade our team plan',
    'How do I change my billing plan?',
  ])('matches plan change: %s', message => {
    expect(PLAN_CHANGE.test(message)).toBe(true)
  })

  it.each([
    'Please upgrade the editor to support markdown',
    'Can you upgrade the API docs?',
    'I need to change my account email',
  ])('does not match: %s', message => {
    expect(PLAN_CHANGE.test(message)).toBe(false)
  })
})

describe('calculateUrgency', () => {
  it('treats outages as High', () => {
    expect(calculateUrgency('the site went down', 'Technical Problem').urgency).toBe('High')
    expect(calculateUrgency('server down now', 'Technical Problem').urgency).toBe('High')
    expect(calculateUrgency('database connection lost', 'Technical Problem').urgency).toBe('High')
  })

  it('ignores "slow down" and "download"', () => {
    expect(calculateUrgency('please slow down the animations', 'Technical Problem').urgency).toBe('Medium')
    expect(calculateUrgency("i can't download my invoice", 'Billing Issue').urgency).toBe('Medium')
  })

  it('is not affected by punctuation or length', () => {
    expect(calculateUrgency('Thank you!!!!!!', 'Positive Feedback').urgency).toBe('Low')
    expect(calculateUrgency('a '.repeat(200), 'General Inquiry').urgency).toBe('Low')
  })

  it('raises low-priority messages only when the customer says it is urgent', () => {
    expect(calculateUrgency('Urgent: how do I export?', 'General Inquiry').urgency).toBe('Medium')
  })
})

describe('detectSentiment', () => {
  it('reads tone', () => {
    expect(detectSentiment('This is ridiculous, fix it')).toBe('Angry')
    expect(detectSentiment('Still not working, very frustrating')).toBe('Frustrated')
    expect(detectSentiment('Thanks, great job!')).toBe('Positive')
    expect(detectSentiment('How do I export data?')).toBe('Neutral')
  })
})
