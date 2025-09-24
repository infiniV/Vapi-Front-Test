'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { vapiService } from '@/lib/vapi-service'

interface DiagnosticResult {
  test: string
  status: 'success' | 'error' | 'warning'
  message: string
  details?: any
}

export function VapiDiagnostics() {
  const [results, setResults] = useState<DiagnosticResult[]>([])
  const [running, setRunning] = useState(false)

  const runDiagnostics = async () => {
    setRunning(true)
    setResults([])
    
    const diagnostics: DiagnosticResult[] = []

    // Test 1: API Connection
    try {
      await vapiService.getPhoneNumbers()
      diagnostics.push({
        test: 'VAPI API Connection',
        status: 'success',
        message: 'Successfully connected to VAPI API'
      })
    } catch (error) {
      diagnostics.push({
        test: 'VAPI API Connection',
        status: 'error',
        message: `Failed to connect to VAPI API: ${error}`,
        details: error
      })
    }

    // Test 2: Credentials Check
    try {
      const credentials = await vapiService.listCredentials()
      const sipCredentials = credentials.filter((c: any) => c.provider === 'byo-sip-trunk')
      
      if (sipCredentials.length === 0) {
        diagnostics.push({
          test: 'SIP Trunk Credentials',
          status: 'warning',
          message: 'No SIP trunk credentials found'
        })
      } else {
        diagnostics.push({
          test: 'SIP Trunk Credentials',
          status: 'success',
          message: `Found ${sipCredentials.length} SIP trunk credential(s)`,
          details: sipCredentials
        })
      }
    } catch (error) {
      diagnostics.push({
        test: 'SIP Trunk Credentials',
        status: 'error',
        message: `Failed to check credentials: ${error}`
      })
    }

    // Test 3: Phone Numbers Check
    try {
      const phoneNumbers = await vapiService.getPhoneNumbers()
      const byoNumbers = phoneNumbers.filter((p: any) => p.provider === 'byo-phone-number')
      
      if (byoNumbers.length === 0) {
        diagnostics.push({
          test: 'BYO Phone Numbers',
          status: 'warning',
          message: 'No BYO phone numbers found'
        })
      } else {
        diagnostics.push({
          test: 'BYO Phone Numbers',
          status: 'success',
          message: `Found ${byoNumbers.length} BYO phone number(s)`,
          details: byoNumbers
        })
      }
    } catch (error) {
      diagnostics.push({
        test: 'BYO Phone Numbers',
        status: 'error',
        message: `Failed to check phone numbers: ${error}`
      })
    }

    // Test 4: Assistants Check
    try {
      const assistants = await vapiService.getAssistants()
      
      if (assistants.length === 0) {
        diagnostics.push({
          test: 'Assistants',
          status: 'warning',
          message: 'No assistants found'
        })
      } else {
        diagnostics.push({
          test: 'Assistants',
          status: 'success',
          message: `Found ${assistants.length} assistant(s)`,
          details: assistants
        })
      }
    } catch (error) {
      diagnostics.push({
        test: 'Assistants',
        status: 'error',
        message: `Failed to check assistants: ${error}`
      })
    }

    setResults(diagnostics)
    setRunning(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'default'
      case 'warning': return 'secondary' 
      case 'error': return 'destructive'
      default: return 'outline'
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>VAPI Connection Diagnostics</CardTitle>
        <CardDescription>
          Test your VAPI configuration and connectivity
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDiagnostics} 
          disabled={running}
          className="w-full"
        >
          {running ? 'Running Diagnostics...' : 'Run Diagnostics'}
        </Button>

        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((result, index) => (
              <div key={index} className="p-3 border rounded">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{result.test}</h4>
                  <Badge variant={getStatusColor(result.status) as any}>
                    {result.status.toUpperCase()}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">{result.message}</p>
                {result.details && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer text-blue-600">
                      Show Details
                    </summary>
                    <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}