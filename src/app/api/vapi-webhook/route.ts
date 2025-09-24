// Example Next.js App Router API route to receive Vapi Server URL events
// Place this at `src/app/api/vapi-webhook/route.ts`

import { NextResponse } from 'next/server'
import { pushWebhookEvent, listWebhookEvents } from '@/lib/vapi-webhook-store'
import crypto from 'crypto'

const SIGNATURE_HEADER = 'x-vapi-signature'

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function verifySignature(secret: string | undefined, body: string, signatureHeader: string | null) {
  if (!secret || !signatureHeader) return false
  try {
    // HMAC SHA256 hex signature expected
    const hmac = crypto.createHmac('sha256', secret)
    hmac.update(body)
    const digest = hmac.digest('hex')
    // simple equality; in production use constant-time compare
    return digest === signatureHeader
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || ''
    const rawText = await request.text()

    // compute size
    const size = rawText.length

    // parse JSON if possible
    const parsed = contentType.includes('application/json') ? safeJsonParse(rawText) : safeJsonParse(rawText)

    const payload = parsed ?? { raw: rawText }

    // Optional signature verification using env var
    // NOTE: in this project many envs are exposed client-side. Prefer server-only env var in real deployment.
    const secret = process.env.NEXT_PUBLIC_VAPI_WEBHOOK_SECRET || process.env.VAPI_WEBHOOK_SECRET
    const signatureHeader = request.headers.get(SIGNATURE_HEADER)
    const verified = verifySignature(secret, rawText, signatureHeader)

    const stored = pushWebhookEvent({
      payload: { receivedHeaders: Object.fromEntries(request.headers), payload },
      contentType,
      size,
      verified,
    })

    console.log('[vapi-webhook] saved event:', stored.id, { size, contentType, verified })

    return NextResponse.json({ received: true, id: stored.id }, { status: 200 })
  } catch (err) {
    console.error('[vapi-webhook] error parsing request:', err)
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 })
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const limitParam = url.searchParams.get('limit')
    const sinceParam = url.searchParams.get('since')
    const limit = limitParam ? Math.min(200, Number(limitParam) || 50) : 100

    const events = listWebhookEvents(limit, sinceParam || undefined)
    return NextResponse.json({ events }, { status: 200 })
  } catch (err) {
    console.error('[vapi-webhook] error listing events:', err)
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}
