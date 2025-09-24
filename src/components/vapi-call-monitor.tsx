"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { vapiService } from "@/lib/vapi-service";
import { formatPhoneNumber, validateE164PhoneNumber } from "@/lib/utils";
import { SipTrunkManager } from "./sip-trunk-manager";
import { VapiDiagnostics } from "./vapi-diagnostics";
import { ApiCallMonitor } from "./api-call-monitor";
import ServerWebhookMonitor from './server-webhook-monitor'

interface PhoneNumber {
  id: string;
  name: string;
  number: string;
  provider: string;
  status: string;
}

interface Assistant {
  id: string;
  name: string;
  model?: {
    provider?: string;
    model?: string;
  };
  voice?: {
    provider?: string;
    voiceId?: string;
  };
  firstMessage?: string;
}

interface CallResponse {
  id: string;
  status: string;
  assistantId?: string;
  phoneNumberId?: string;
  customer?: {
    number: string;
    name?: string;
  };
  monitor?: {
    listenUrl: string;
    controlUrl: string;
  };
  createdAt?: string;
  updatedAt?: string;
  cost?: number;
  transcript?: string;
  recordingUrl?: string;
  summary?: string;
  endedReason?: string;
}

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
  source?: 'listen' | 'poll'; // Track which source the message came from
}

interface WebSocketConnection {
  url: string;
  ws: WebSocket | null;
  connected: boolean;
  retryCount: number;
}

export function VapiCallMonitor() {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState<string>("");
  const [targetNumber, setTargetNumber] = useState<string>("");
  const [assistantId, setAssistantId] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [apiResponse, setApiResponse] = useState<CallResponse | null>(null);
  const [apiRequest, setApiRequest] = useState<any>(null);
  const [wsMessages, setWsMessages] = useState<WebSocketMessage[]>([]);
  // Only listen connections are opened via WebSocket in the browser.
  const [wsConnection, setWsConnection] = useState<WebSocketConnection>({ url: '', ws: null, connected: false, retryCount: 0 });
  const [currentCall, setCurrentCall] = useState<CallResponse | null>(null);
  const [selectedCredentialId, setSelectedCredentialId] = useState<string>("");
  const [manualCallMode, setManualCallMode] = useState<boolean>(false);
  const [rawCallResponse, setRawCallResponse] = useState<string>("");
  const [customMetadata, setCustomMetadata] = useState<Array<{key: string, value: string, id: number}>>([]);
  const [metadataCounter, setMetadataCounter] = useState(0);
  const listenWsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<number | null>(null);

  // Load phone numbers and assistants on component mount
  useEffect(() => {
    loadPhoneNumbers();
    loadAssistants();
  }, []);

  const addMetadataField = () => {
    const newId = metadataCounter + 1;
    setCustomMetadata(prev => [...prev, { key: '', value: '', id: newId }]);
    setMetadataCounter(newId);
  };

  const removeMetadataField = (id: number) => {
    setCustomMetadata(prev => prev.filter(field => field.id !== id));
  };

  const updateMetadataField = (id: number, key: string, value: string) => {
    setCustomMetadata(prev => 
      prev.map(field => 
        field.id === id ? { ...field, key, value } : field
      )
    );
  };

  const getMetadataObject = () => {
    const metadata: Record<string, any> = {};
    customMetadata.forEach(field => {
      if (field.key.trim() && field.value.trim()) {
        // Try to parse as JSON if it looks like JSON, otherwise treat as string
        try {
          if (field.value.startsWith('{') || field.value.startsWith('[') || field.value === 'true' || field.value === 'false' || !isNaN(Number(field.value))) {
            metadata[field.key.trim()] = JSON.parse(field.value);
          } else {
            metadata[field.key.trim()] = field.value;
          }
        } catch {
          metadata[field.key.trim()] = field.value;
        }
      }
    });
    return metadata;
  };

  const loadPhoneNumbers = async () => {
    try {
      const numbers = await vapiService.getPhoneNumbers();
      setPhoneNumbers(numbers);
      if (numbers.length > 0) {
        setSelectedPhoneNumber(numbers[0].id);
      }
    } catch (error) {
      console.error("Failed to load phone numbers:", error);
    }
  };

  const loadAssistants = async () => {
    try {
      const assistantsList = await vapiService.getAssistants();
      setAssistants(assistantsList);
      if (assistantsList.length > 0) {
        setAssistantId(assistantsList[0].id);
      }
    } catch (error) {
      console.error("Failed to load assistants:", error);
    }
  };

  const checkAssistantMonitoring = async (assistantIdToCheck: string) => {
    try {
      const status = await vapiService.verifyAssistantMonitoring(assistantIdToCheck);
      const { monitoring, recommendation } = status;
      
      alert(`📊 Assistant Monitoring Status:
      
• Monitor Plan: ${monitoring.configured ? '✅ Configured' : '❌ Not Configured'}
• Listen Enabled: ${monitoring.listenEnabled ? '✅ Yes' : '❌ No'}
• Control Enabled: ${monitoring.controlEnabled ? '✅ Yes' : '❌ No'}
• Authentication: ${monitoring.listenAuth || monitoring.controlAuth ? '🔒 Enabled' : '🔓 Disabled'}

💡 Recommendation: ${recommendation}`);
    } catch (error) {
      console.error('Failed to check monitoring status:', error);
      alert(`❌ Failed to check monitoring status: ${error}`);
    }
  };

  const enableAssistantMonitoring = async (assistantIdToEnable: string) => {
    try {
      await vapiService.enableAssistantMonitoring(assistantIdToEnable);
      alert(`✅ Monitoring enabled for assistant ${assistantIdToEnable}`);
      // Refresh assistants list to show updated monitoring status
      await loadAssistants();
    } catch (error) {
      console.error('Failed to enable monitoring:', error);
      alert(`❌ Failed to enable monitoring: ${error}`);
    }
  };

  const makeCall = async () => {
    if (!selectedPhoneNumber || !targetNumber || !assistantId) {
      alert("Please fill in all required fields");
      return;
    }

    setLoading(true);
    try {
      // Validate and format the target number to E.164
      const formattedTargetNumber = validateE164PhoneNumber(targetNumber);
      
      const request = {
        assistantId,
        phoneNumberId: selectedPhoneNumber,
        customer: {
          number: formattedTargetNumber,
          name: `Customer ${formattedTargetNumber}`
        }
      };

      // Get selected phone number and assistant details for logging
      const selectedPhone = phoneNumbers.find(p => p.id === selectedPhoneNumber);
      const selectedAssistant = assistants.find(a => a.id === assistantId);

      console.log('📞 Initiating VAPI Call:', {
        api: 'POST /call',
        description: 'Start outbound phone call using VAPI AI assistant',
        payload: request,
        details: {
          fromPhone: selectedPhone ? `${selectedPhone.name} (${selectedPhone.number})` : selectedPhoneNumber,
          toPhone: formattedTargetNumber,
          assistant: selectedAssistant ? `${selectedAssistant.name}` : assistantId,
          originalInput: targetNumber,
          formattedOutput: formattedTargetNumber
        }
      });

      // Get metadata object from custom fields
      const metadata = getMetadataObject();
      
      setApiRequest(metadata && Object.keys(metadata).length > 0 ? { ...request, metadata } : request);
      
      const response = await vapiService.makeCall(
        assistantId,
        selectedPhoneNumber,
        formattedTargetNumber,
        `Customer ${formattedTargetNumber}`,
        metadata
      );
      setApiResponse(response);
      setCurrentCall(response);
      
      // Connect to listen WebSocket URL if available; controlUrl is informational
      if (response.monitor?.listenUrl) {
        connectWebSockets(response.monitor.listenUrl, response.monitor.controlUrl);
      } else if (response.id) {
        // If no monitor URLs provided, start polling the call endpoint for updates
        startPollingCall(response.id);
      }
    } catch (error) {
      console.error("Failed to make call:", error);
      alert("Failed to make call. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const startPollingCall = (callId: string) => {
    stopPollingCall();
    addWsMessage('poll', `Starting polling for call ${callId}`, 'poll');
    // Poll every 3s
    pollRef.current = window.setInterval(async () => {
      try {
        const updated = await vapiService.getCall(callId);
        addWsMessage('poll', { callId, updated }, 'poll');

        // Update current call state
        setCurrentCall(updated);

        // If monitor URLs appear, connect and stop polling
        if (updated?.monitor?.listenUrl || updated?.monitor?.controlUrl) {
          addWsMessage('connection', `Discovered monitor URLs via polling`, 'poll');
          connectWebSockets(updated.monitor.listenUrl, updated.monitor.controlUrl);
          stopPollingCall();
        }

        // Stop polling if call ended
        if (updated?.status && ['ended', 'completed', 'failed'].includes(updated.status)) {
          addWsMessage('poll', `Call ${callId} ended with status ${updated.status}, stopping poll`, 'poll');
          stopPollingCall();
        }
      } catch (err) {
        addWsMessage('error', `Polling error for call ${callId}: ${err}`, 'poll');
      }
    }, 3000);
  };

  const stopPollingCall = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      addWsMessage('poll', 'Stopped polling for call updates', 'poll');
    }
  };

  const connectWebSockets = (listenUrl?: string, controlUrl?: string) => {
    // Close existing listen connection, then open new one if provided.
    disconnectWebSockets();
    if (listenUrl) connectWebSocket(listenUrl);

    // Control URLs are informational only in the browser UI (not opened as WebSockets).
    if (controlUrl) addWsMessage('info', `Control URL provided (not opened in browser): ${controlUrl}`, 'listen');
  };

  const disconnectWebSockets = () => {
    if (listenWsRef.current) {
      listenWsRef.current.close();
      listenWsRef.current = null;
    }
    setWsConnection(prev => ({ ...prev, connected: false, retryCount: 0 }));
  };

  const connectWebSocket = (wsUrl: string) => {
    try {
      addWsMessage('connection', `Connecting to listen WebSocket: ${wsUrl}`, 'listen');
      const ws = new WebSocket(wsUrl);
      listenWsRef.current = ws;

      // Update connection state
      setWsConnection(prev => ({ ...prev, url: wsUrl, ws, retryCount: 0 }));

      // Ensure we treat listen streams as binary when appropriate (audio frames)
      try { ws.binaryType = 'arraybuffer'; } catch {}

      // Set timeout for connection
      const connectionTimeout = setTimeout(() => {
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.close();
          addWsMessage('error', `Listen WebSocket connection timeout after 10 seconds`, 'listen');
          setWsConnection(prev => ({ ...prev, connected: false }));
        }
      }, 10000);

      ws.onopen = () => {
        clearTimeout(connectionTimeout);
        setWsConnection(prev => ({ ...prev, connected: true }));
        addWsMessage('connection', `Listen WebSocket connected successfully`, 'listen');
      };

      ws.onmessage = (event: MessageEvent) => {
        // Normalize all incoming payload types (string, Blob, ArrayBuffer, object)
        (async () => {
          const { parsed, isJson, raw, isBinary, url, size } = await normalizeWsData(event.data);

          if (isJson && parsed) {
            // If parsed JSON looks like a structured event, treat as a message
            addWsMessage("message", parsed, 'listen');

            // Update call status if it's a status update
            if (parsed && parsed.type === "status-update" && currentCall) {
              setCurrentCall(prev => prev ? { ...prev, ...parsed.call } : null);
            }
          } else if (isBinary) {
            // For binary audio/data create a download entry and mark as raw-binary
            addWsMessage("raw", { binary: true, url, size }, 'listen');
          } else {
            // For non-JSON payloads preserve human-readable text in the 'raw' message type
            addWsMessage("raw", parsed || raw || String(event.data), 'listen');
          }
        })().catch(err => {
          addWsMessage('error', `Failed to parse incoming WS message: ${err}`, 'listen');
        });
      };

      ws.onclose = (event: CloseEvent) => {
        clearTimeout(connectionTimeout);
        setWsConnection(prev => ({ ...prev, connected: false }));

        if (event.wasClean) {
          addWsMessage('connection', `Listen WebSocket disconnected cleanly (code: ${event.code})`, 'listen');
        } else {
          addWsMessage('connection', `Listen WebSocket disconnected unexpectedly (code: ${event.code}, reason: ${event.reason})`, 'listen');
          // Retry logic based on single listen connection state
          if (wsConnection.retryCount < 3) {
            const retryDelay = Math.pow(2, wsConnection.retryCount) * 1000; // Exponential backoff
            setTimeout(() => {
              addWsMessage('connection', `Retrying listen connection (attempt ${wsConnection.retryCount + 1}/3) in ${retryDelay/1000}s...`, 'listen');
              setWsConnection(prev => ({ ...prev, retryCount: prev.retryCount + 1 }));
              connectWebSocket(wsUrl);
            }, retryDelay);
          }
        }
      };

      ws.onerror = (error: Event) => {
        clearTimeout(connectionTimeout);
        addWsMessage('error', `Listen WebSocket error: ${error}`, 'listen');
        setWsConnection(prev => ({ ...prev, connected: false }));
      };
    } catch (error) {
      console.error('Failed to connect listen WebSocket:', error);
      addWsMessage('error', `Failed to create listen WebSocket connection: ${error}`, 'listen');
    }
  };

  const addWsMessage = (type: string, data: any, source: 'listen' | 'poll' = 'listen') => {
    const message: WebSocketMessage = {
      type,
      data,
      timestamp: new Date().toISOString(),
      source
    };
    setWsMessages(prev => [...prev, message].slice(-100)); // Keep last 100 messages
  };

  const makeManualCall = async () => {
    if (!rawCallResponse.trim()) {
      alert("Please enter call parameters");
      return;
    }

    setLoading(true);
    try {
      const callData = JSON.parse(rawCallResponse);
      
      console.log('📞 Manual VAPI Call:', {
        api: 'POST /call',
        description: 'Manual call initiation with custom parameters',
        payload: callData
      });

      setApiRequest(callData);
      
      const response = await vapiService.makeCall(
        callData.assistantId,
        callData.phoneNumberId,
        callData.customer.number,
        callData.customer.name
      );
      
      setApiResponse(response);
      setCurrentCall(response);
      
      // Connect to listen WebSocket URL if available; controlUrl is informational
      if (response.monitor?.listenUrl) {
        connectWebSockets(response.monitor.listenUrl, response.monitor.controlUrl);
      } else if (response.id) {
        startPollingCall(response.id);
      }
    } catch (error) {
      console.error("Failed to make manual call:", error);
      alert("Failed to make manual call. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const normalizeWsData = async (data: any): Promise<{ parsed: any; isJson: boolean; raw: string; isBinary?: boolean; url?: string; size?: number }> => {
    try {
      // If already a string, try to parse JSON
      if (typeof data === 'string') {
        try {
          return { parsed: JSON.parse(data), isJson: true, raw: data };
        } catch {
          return { parsed: data, isJson: false, raw: data };
        }
      }

      // If it's a Blob (binary text), read as text or arrayBuffer
      if (typeof Blob !== 'undefined' && data instanceof Blob) {
        // Try to detect if it's text-like by reading a small slice
        const slice = data.slice(0, 256);
        const text = await slice.text();
        try {
          return { parsed: JSON.parse(text), isJson: true, raw: text };
        } catch {
          // treat as binary: create object URL and return
          const fullArrayBuffer = await data.arrayBuffer();
          const size = fullArrayBuffer.byteLength;
          const blob = new Blob([fullArrayBuffer], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          return { parsed: { binary: true }, isJson: false, raw: '', isBinary: true, url, size };
        }
      }

      // If it's an ArrayBuffer, decode it or treat as binary
      if (data instanceof ArrayBuffer) {
        // Heuristic: check printable ratio to decide whether it's text
        const bytes = new Uint8Array(data);
        let printable = 0;
        for (let i = 0; i < Math.min(512, bytes.length); i++) {
          const b = bytes[i];
          if (b === 9 || b === 10 || b === 13 || (b >= 32 && b <= 126)) printable++;
        }
        const ratio = printable / Math.min(512, bytes.length || 1);

        if (ratio > 0.6) {
          // Treat as text
          const text = new TextDecoder().decode(bytes);
          try {
            return { parsed: JSON.parse(text), isJson: true, raw: text };
          } catch {
            return { parsed: text, isJson: false, raw: text };
          }
        }

        // Otherwise treat as binary audio/data: create blob URL for download
        const size = bytes.byteLength;
        const blob = new Blob([bytes], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        return { parsed: { binary: true }, isJson: false, raw: '', isBinary: true, url, size };
      }

      // MessageEvent sometimes wraps parsed objects already
      if (typeof data === 'object') {
        return { parsed: data, isJson: true, raw: JSON.stringify(data) };
      }

      // Fallback to string coercion
      const fallback = String(data);
      return { parsed: fallback, isJson: false, raw: fallback };
    } catch (err) {
      return { parsed: `<unreadable binary>`, isJson: false, raw: '' };
    }
  };

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      disconnectWebSockets();
      stopPollingCall();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* VAPI Diagnostics */}
      <VapiDiagnostics />

      {/* API Call Monitor */}
      <ApiCallMonitor />

      {/* SIP Trunk Management */}
      <Card>
        <CardHeader>
          <CardTitle>SIP Trunk Management</CardTitle>
          <CardDescription>
            Manage your SIP trunk credentials for call routing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SipTrunkManager onCredentialSelect={setSelectedCredentialId} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Call Setup Section */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Make a Call</CardTitle>
            <CardDescription>
              Select a phone number and enter call details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Call Mode</Label>
              <div className="flex items-center space-x-2">
                <Button
                  variant={!manualCallMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setManualCallMode(false)}
                >
                  Assistant
                </Button>
                <Button
                  variant={manualCallMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setManualCallMode(true)}
                >
                  Manual JSON
                </Button>
              </div>
            </div>

            {!manualCallMode ? (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="assistant">Assistant</Label>
                    {assistantId && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => checkAssistantMonitoring(assistantId)}
                          className="text-xs"
                        >
                          Check Status
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => enableAssistantMonitoring(assistantId)}
                          className="text-xs"
                        >
                          Enable Monitoring
                        </Button>
                      </div>
                    )}
                  </div>
                  <Select value={assistantId} onValueChange={setAssistantId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an assistant" />
                    </SelectTrigger>
                    <SelectContent>
                      {assistants.map((assistant) => (
                        <SelectItem key={assistant.id} value={assistant.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{assistant.name}</span>
                            <span className="text-xs text-gray-500">ID: {assistant.id}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="mt-1 text-xs text-gray-500">
                    💡 If WebSocket connections fail, click "Enable Monitoring" to configure the assistant for real-time monitoring
                  </div>
                </div>

                <div>
                  <Label htmlFor="phone-number">From Phone Number</Label>
                  <Select value={selectedPhoneNumber} onValueChange={setSelectedPhoneNumber}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a phone number" />
                    </SelectTrigger>
                    <SelectContent>
                      {phoneNumbers.map((phone) => (
                        <SelectItem key={phone.id} value={phone.id}>
                          {phone.name} ({formatPhoneNumber(phone.number)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="target-number">To Phone Number</Label>
                  <Input
                    id="target-number"
                    placeholder="+1234567890 (E.164 format)"
                    value={targetNumber}
                    onChange={(e) => setTargetNumber(e.target.value)}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter in E.164 format (+1234567890) or US format (234-567-8900)
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Custom Metadata</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addMetadataField}
                    >
                      Add Field
                    </Button>
                  </div>
                  
                  {customMetadata.map((field) => (
                    <div key={field.id} className="flex gap-2 items-center">
                      <Input
                        placeholder="Key (e.g., correlationId)"
                        value={field.key}
                        onChange={(e) => updateMetadataField(field.id, e.target.value, field.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Value (e.g., abc123 or JSON object)"
                        value={field.value}
                        onChange={(e) => updateMetadataField(field.id, field.key, e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeMetadataField(field.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  
                  {customMetadata.length === 0 && (
                    <p className="text-xs text-gray-500">
                      Add custom key-value pairs to include in call metadata. Values can be strings, numbers, booleans, or JSON objects.
                    </p>
                  )}
                </div>

                <Button 
                  onClick={makeCall} 
                  disabled={loading || !selectedPhoneNumber || !targetNumber || !assistantId}
                  className="w-full"
                >
                  {loading ? "Making Call..." : "Make Call"}
                </Button>
              </>
            ) : (
              <>
                <div>
                  <Label htmlFor="manual-call">Call Parameters (JSON)</Label>
                  <Textarea
                    id="manual-call"
                    placeholder={JSON.stringify({
                      assistantId: "your-assistant-id",
                      phoneNumberId: "your-phone-number-id",
                      customer: {
                        number: "+1234567890",
                        name: "Customer Name"
                      },
                      metadata: {
                        correlationId: "abc123",
                        campaignType: "demo",
                        priority: 1,
                        customData: {
                          source: "web-ui",
                          timestamp: "2025-09-24T16:00:00Z"
                        }
                      }
                    }, null, 2)}
                    value={rawCallResponse}
                    onChange={(e) => setRawCallResponse(e.target.value)}
                    className="font-mono text-sm min-h-[150px]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter JSON parameters for manual call initiation (equivalent to curl command)
                  </p>
                </div>

                <Button 
                  onClick={makeManualCall} 
                  disabled={loading || !rawCallResponse.trim()}
                  className="w-full"
                >
                  {loading ? "Making Call..." : "Make Manual Call"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Phone Numbers List */}
        <Card>
          <CardHeader>
            <CardTitle>Available Phone Numbers</CardTitle>
            <CardDescription>
              Your configured VAPI phone numbers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {phoneNumbers.length === 0 ? (
              <p className="text-muted-foreground">No phone numbers configured</p>
            ) : (
              <div className="space-y-2">
                {phoneNumbers.map((phone) => (
                  <div key={phone.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <p className="font-medium">{phone.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatPhoneNumber(phone.number)}
                      </p>
                    </div>
                    <Badge variant={phone.status === "active" ? "default" : "secondary"}>
                      {phone.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assistants List */}
        <Card>
          <CardHeader>
            <CardTitle>Available Assistants</CardTitle>
            <CardDescription>
              Your configured VAPI assistants
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assistants.length === 0 ? (
              <p className="text-muted-foreground">No assistants configured</p>
            ) : (
              <div className="space-y-2">
                {assistants.map((assistant) => (
                  <div key={assistant.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex-1">
                      <p className="font-medium">{assistant.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        ID: {assistant.id}
                      </p>
                      {assistant.model && (
                        <p className="text-xs text-muted-foreground">
                          Model: {assistant.model.provider}/{assistant.model.model}
                        </p>
                      )}
                      {assistant.voice && (
                        <p className="text-xs text-muted-foreground">
                          Voice: {assistant.voice.provider}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <Badge variant="default">Assistant</Badge>
                      {assistant.firstMessage && (
                        <p className="text-xs text-muted-foreground mt-1 max-w-[150px] truncate">
                          "{assistant.firstMessage}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* API Response and WebSocket Section */}
      <div className="space-y-6">
        {/* API Request/Response */}
        {(apiRequest || apiResponse) && (
          <Card>
            <CardHeader>
              <CardTitle>API Call Details</CardTitle>
              <CardDescription>
                Request and response from VAPI API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {apiRequest && (
                <div>
                  <Label>Request:</Label>
                  <Textarea
                    value={JSON.stringify(apiRequest, null, 2)}
                    readOnly
                    className="font-mono text-sm min-h-[100px]"
                  />
                </div>
              )}
              
              {apiResponse && (
                <div>
                  <Label>Response:</Label>
                  <Textarea
                    value={JSON.stringify(apiResponse, null, 2)}
                    readOnly
                    className="font-mono text-sm min-h-[150px]"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Call Status */}
        {currentCall && (
          <Card>
            <CardHeader>
              <CardTitle>Call Status</CardTitle>
              <CardDescription>
                Real-time call information and monitor URLs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-medium text-sm text-gray-600">Call ID:</span>
                    <p className="font-mono text-sm break-all">{currentCall.id}</p>
                  </div>
                  <div>
                    <span className="font-medium text-sm text-gray-600">Status:</span>
                    <div className="mt-1">
                      <Badge variant={
                        currentCall.status === 'queued' ? 'secondary' :
                        currentCall.status === 'ringing' ? 'default' :
                        currentCall.status === 'in-progress' ? 'default' :
                        currentCall.status === 'ended' ? 'outline' :
                        'secondary'
                      }>{currentCall.status}</Badge>
                    </div>
                  </div>
                </div>

                {currentCall.customer && (
                  <div>
                    <span className="font-medium text-sm text-gray-600">Customer:</span>
                    <p className="text-sm">
                      {currentCall.customer.name || 'Unknown'} - {formatPhoneNumber(currentCall.customer.number)}
                    </p>
                  </div>
                )}

                {(currentCall.assistantId || currentCall.phoneNumberId) && (
                  <div className="grid grid-cols-2 gap-4">
                    {currentCall.assistantId && (
                      <div>
                        <span className="font-medium text-sm text-gray-600">Assistant ID:</span>
                        <p className="font-mono text-xs break-all">{currentCall.assistantId}</p>
                      </div>
                    )}
                    {currentCall.phoneNumberId && (
                      <div>
                        <span className="font-medium text-sm text-gray-600">Phone Number ID:</span>
                        <p className="font-mono text-xs break-all">{currentCall.phoneNumberId}</p>
                      </div>
                    )}
                  </div>
                )}

                {currentCall.monitor && (
                  <div className="border-t pt-3">
                    <span className="font-medium text-sm text-gray-600">Monitor URLs:</span>
                    <div className="mt-2 space-y-2">
                      {currentCall.monitor.listenUrl && (
                        <div>
                          <Label className="text-xs text-gray-500">Listen WebSocket:</Label>
                          <p className="font-mono text-xs break-all bg-gray-50 p-2 rounded">
                            {currentCall.monitor.listenUrl}
                          </p>
                        </div>
                      )}
                      {currentCall.monitor.controlUrl && (
                        <div>
                          <Label className="text-xs text-gray-500">Control WebSocket:</Label>
                          <p className="font-mono text-xs break-all bg-gray-50 p-2 rounded">
                            {currentCall.monitor.controlUrl}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(currentCall.cost !== undefined || currentCall.endedReason || currentCall.createdAt) && (
                  <div className="border-t pt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    {currentCall.cost !== undefined && (
                      <div>
                        <span className="font-medium text-gray-600">Cost:</span>
                        <p>${currentCall.cost.toFixed(4)}</p>
                      </div>
                    )}
                    {currentCall.endedReason && (
                      <div>
                        <span className="font-medium text-gray-600">End Reason:</span>
                        <p>{currentCall.endedReason}</p>
                      </div>
                    )}
                    {currentCall.createdAt && (
                      <div>
                        <span className="font-medium text-gray-600">Created:</span>
                        <p>{new Date(currentCall.createdAt).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* WebSocket Messages */}
          <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              WebSocket Monitor
              <div className="flex gap-2">
                <Badge variant={wsConnection.connected ? 'default' : 'secondary'}>
                  Listen: {wsConnection.connected ? 'Connected' : 'Disconnected'}
                </Badge>
              </div>
            </CardTitle>
            <CardDescription>
              Real-time call events from both listen and control WebSockets
            </CardDescription>
            {!wsConnection.connected && wsMessages.some(msg => msg.type === 'error') && (
               <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                 <h4 className="text-sm font-medium text-yellow-800 mb-2">🔧 WebSocket Connection Troubleshooting</h4>
                 <div className="text-xs text-yellow-700 space-y-1">
                   <p>• <strong>Monitor Plan Required:</strong> The assistant needs monitoring enabled to generate WebSocket URLs</p>
                   <p>• <strong>Quick Fix:</strong> Click "Enable Monitoring" button above to configure the assistant</p>
                   <p>• <strong>CORS/Security / Network:</strong> Browser may be blocked by network/firewall or TLS issues when connecting to remote WebSocket hosts</p>
                   <p>• <strong>Normal Behavior:</strong> Calls will still work without WebSocket monitoring</p>
                 </div>
               </div>
             )}
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {wsMessages.length === 0 ? (
                <p className="text-muted-foreground">No WebSocket messages yet</p>
              ) : (
                wsMessages.map((msg, index) => (
                  <div key={index} className="p-2 border rounded text-sm">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">{msg.type}</Badge>
                        <Badge variant={msg.source === 'listen' ? 'default' : 'secondary'} className="text-xs">{msg.source}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(msg.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    {typeof msg.data === 'object' && msg.data?.binary ? (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-700">Binary payload — {msg.data.size ?? 'unknown'} bytes</div>
                        {msg.data.url ? (
                          <a className="text-xs text-blue-600" href={msg.data.url} download={`vapi-audio-${index}.pcm`}>Download .pcm</a>
                        ) : (
                          <pre className="text-xs overflow-x-auto">{JSON.stringify(msg.data, null, 2)}</pre>
                        )}
                      </div>
                    ) : (
                      <pre className="text-xs overflow-x-auto">{typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data, null, 2)}</pre>
                    )}
                   </div>
                 ))
               )}
            </div>
          </CardContent>
        </Card>
        {/* Server webhook monitor (shows events posted to server URLs by Vapi) */}
        <ServerWebhookMonitor />
      </div>
    </div>
    </div>
  );
}