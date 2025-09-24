'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface ApiCall {
  id: string
  timestamp: string
  method: string
  endpoint: string
  url: string
  description: string
  headers: Record<string, string>
  body?: any
  response?: {
    status: number
    data: any
  }
  error?: any
  success: boolean
  duration?: number
}

export function ApiCallMonitor() {
  const [apiCalls, setApiCalls] = useState<ApiCall[]>([])
  const [showDetails, setShowDetails] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const handleApiCall = (event: CustomEvent) => {
      const { request, response, error, success } = event.detail
      
      const apiCall: ApiCall = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: request.timestamp,
        method: request.method,
        endpoint: request.endpoint,
        url: request.url,
        description: request.description,
        headers: request.headers,
        body: request.body,
        response: response,
        error: error,
        success: success
      }

      setApiCalls(prev => [apiCall, ...prev].slice(0, 20)) // Keep last 20 calls
    }

    window.addEventListener('vapiApiCall', handleApiCall as EventListener)
    return () => window.removeEventListener('vapiApiCall', handleApiCall as EventListener)
  }, [])

  const toggleDetails = (id: string) => {
    setShowDetails(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const clearCalls = () => {
    setApiCalls([])
    setShowDetails({})
  }

  const getStatusColor = (success: boolean, status?: number) => {
    if (!success) return 'destructive'
    if (status && status >= 200 && status < 300) return 'default'
    return 'secondary'
  }

  const formatHeaders = (headers: Record<string, string>) => {
    const filtered = { ...headers }
    // Hide sensitive information
    if (filtered.Authorization) {
      filtered.Authorization = 'Bearer ***[HIDDEN]***'
    }
    return filtered
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>VAPI API Call Monitor</CardTitle>
            <CardDescription>
              Real-time tracking of all VAPI API requests and responses
            </CardDescription>
          </div>
          <Button onClick={clearCalls} variant="outline" size="sm">
            Clear History
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {apiCalls.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            No API calls made yet. Interact with the application to see API requests.
          </p>
        ) : (
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {apiCalls.map((call) => (
              <div key={call.id} className="border rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={call.method === 'GET' ? 'secondary' : call.method === 'POST' ? 'default' : 'outline'}>
                      {call.method}
                    </Badge>
                    <Badge variant={getStatusColor(call.success, call.response?.status) as any}>
                      {call.success ? call.response?.status || 'Success' : 'Error'}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      {new Date(call.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleDetails(call.id)}
                    className="text-xs"
                  >
                    {showDetails[call.id] ? 'Hide' : 'Show'} Details
                  </Button>
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="font-medium text-sm">{call.description}</p>
                    <p className="text-xs text-gray-600">
                      <code className="bg-gray-100 px-1 rounded">{call.endpoint}</code>
                    </p>
                  </div>

                  {showDetails[call.id] && (
                    <div className="space-y-3 border-t pt-3">
                      {/* Request Details */}
                      <div>
                        <h5 className="font-medium text-sm mb-2">📤 Request</h5>
                        <div className="bg-gray-50 p-2 rounded text-xs space-y-2">
                          <div>
                            <strong>URL:</strong>
                            <code className="ml-2 bg-white px-1 rounded">{call.url}</code>
                          </div>
                          
                          <div>
                            <strong>Headers:</strong>
                            <pre className="bg-white p-2 rounded mt-1 overflow-x-auto">
                              {JSON.stringify(formatHeaders(call.headers), null, 2)}
                            </pre>
                          </div>

                          {call.body && (
                            <div>
                              <strong>Body:</strong>
                              <pre className="bg-white p-2 rounded mt-1 overflow-x-auto">
                                {JSON.stringify(call.body, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Response Details */}
                      {call.success && call.response ? (
                        <div>
                          <h5 className="font-medium text-sm mb-2">📥 Response</h5>
                          <div className="bg-green-50 p-2 rounded text-xs space-y-2">
                            <div>
                              <strong>Status:</strong> {call.response.status}
                            </div>
                            <div>
                              <strong>Data:</strong>
                              <pre className="bg-white p-2 rounded mt-1 overflow-x-auto max-h-40">
                                {JSON.stringify(call.response.data, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ) : call.error && (
                        <div>
                          <h5 className="font-medium text-sm mb-2">❌ Error</h5>
                          <div className="bg-red-50 p-2 rounded text-xs">
                            <pre className="bg-white p-2 rounded overflow-x-auto">
                              {JSON.stringify(call.error, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}