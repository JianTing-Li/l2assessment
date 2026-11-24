import { describe, it, expect } from 'vitest'
import { extractIds, splitBatch, parseCsvRows, messagesFromCsv, toCsv, runWithLimit } from './extract'

describe('extractIds', () => {
  it('finds order, invoice and ticket references', () => {
    expect(extractIds('Order #48213 is stuck')).toEqual(['48213'])
    expect(extractIds('I was charged twice for invoice INV-2041')).toEqual(['INV-2041'])
    expect(extractIds('ticket: 88812 and account ID AB12CD')).toEqual(expect.arrayContaining(['88812', 'AB12CD']))
  })

  it('ignores words without digits', () => {
    expect(extractIds('Please check my account details and order history')).toEqual([])
  })
})

describe('splitBatch', () => {
  it('splits on blank lines and trims', () => {
    expect(splitBatch('first\nstill first\n\n  second  \n\n\n\nthird\r\n\r\nfourth')).toEqual(['first\nstill first', 'second', 'third', 'fourth'])
  })
})

describe('CSV', () => {
  it('parses quotes, escaped quotes and newlines in fields', () => {
    expect(parseCsvRows('id,message\n1,"Hello, ""world""\nline two"\n2,plain\n')).toEqual([
      ['id', 'message'],
      ['1', 'Hello, "world"\nline two'],
      ['2', 'plain'],
    ])
  })

  it('uses the message column when there is one', () => {
    expect(messagesFromCsv('id,body,from\n1,Server down,a@x\n2,Thanks!,b@x')).toEqual(['Server down', 'Thanks!'])
  })

  it('uses the first column when there is no known header', () => {
    expect(messagesFromCsv('Server down\nThanks!')).toEqual(['Server down', 'Thanks!'])
  })

  it('round-trips through toCsv', () => {
    const rows = [{ message: 'He said "hi", then left\nbye', ids: ['A-1', 'B-2'] }]
    const csv = toCsv(rows, [['Message', 'message'], ['IDs', 'ids']])
    expect(parseCsvRows(csv)).toEqual([['Message', 'IDs'], ['He said "hi", then left\nbye', 'A-1 B-2']])
  })
})

describe('runWithLimit', () => {
  it('keeps order and never runs more than the limit at once', async () => {
    let running = 0
    let peak = 0
    const results = await runWithLimit([5, 1, 4, 2, 3], 2, async n => {
      running++
      peak = Math.max(peak, running)
      await new Promise(resolve => setTimeout(resolve, n))
      running--
      return n * 10
    })
    expect(results).toEqual([50, 10, 40, 20, 30])
    expect(peak).toBe(2)
  })
})
