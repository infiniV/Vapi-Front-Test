"use client"

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type WebhookEvent = {
  id: string
  receivedAt: string
  payload: any
  contentType?: string
  size?: number
  verified?: boolean
}

export function ServerWebhookMonitor() {
  const [events, setEvents] = useState<WebhookEvent[]>([])
  const [polling, setPolling] = useState(false)
  const intervalRef = useRef<number | null>(null)
  const [limit, setLimit] = useState<number>(50)

  const fetchEvents = async () => {
    try {
      const res = await fetch(`/api/vapi-webhook?limit=${encodeURIComponent(String(limit))}`)
      if (!res.ok) return
      const body = await res.json()
      setEvents(body.events || [])
    } catch (err) {
      console.error('Failed to fetch webhook events', err)
    }
  }

  useEffect(() => {
    // start polling by default
    setPolling(true)
    fetchEvents()
    intervalRef.current = window.setInterval(fetchEvents, 3000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const togglePolling = () => {
    if (polling) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = null
      setPolling(false)
    } else {
      fetchEvents()
      intervalRef.current = window.setInterval(fetchEvents, 3000)
      setPolling(true)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Server Webhook Monitor</CardTitle>
            <CardDescription>Shows recent Server URL events received by the server</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value) || 50)}
              className="w-20 text-sm p-1 border rounded"
              title="Number of events to fetch"
            />
            <Button size="sm" variant="outline" onClick={togglePolling}>{polling ? 'Pause' : 'Resume'}</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-muted-foreground">No webhook events yet</p>
        ) : (
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {events.map(evt => (
              <div key={evt.id} className="p-2 border rounded text-sm">
                <div className="flex justify-between items-center mb-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{evt.id}</Badge>
                    {evt.verified ? (
                      <Badge className="text-xs" variant="default">Verified</Badge>
                    ) : (
                      <Badge className="text-xs" variant="secondary">Unverified</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <div>{new Date(evt.receivedAt).toLocaleTimeString()}</div>
                    <div className="text-xs text-gray-500">{evt.contentType || 'unknown'} · {evt.size ?? '-'} bytes</div>
                  </div>
                </div>
                <details>
                  <summary className="text-xs cursor-pointer text-blue-600">Show Payload</summary>
                  <div className="mt-2">
                    {evt.payload && evt.payload.payload && evt.payload.payload.parsed ? (
                      <pre className="text-xs overflow-x-auto">{JSON.stringify(evt.payload.payload.parsed, null, 2)}</pre>
                    ) : evt.payload && evt.payload.payload && evt.payload.payload.raw ? (
                      <pre className="text-xs overflow-x-auto">{evt.payload.payload.raw}</pre>
                    ) : (
                      <pre className="text-xs overflow-x-auto">{JSON.stringify(evt.payload, null, 2)}</pre>
                    )}

                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer text-gray-600">Headers</summary>
                      <pre className="text-xs overflow-x-auto">{JSON.stringify(evt.payload?.receivedHeaders || evt.payload?.headers || {}, null, 2)}</pre>
                    </details>
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ServerWebhookMonitor
