class VapiService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_VAPI_BASE_URL || 'https://api.vapi.ai';
    this.apiKey = process.env.NEXT_PUBLIC_VAPI_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('VAPI API key not found in environment variables');
    }
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const defaultHeaders = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };

    // Enhanced logging with API call details
    const apiCallInfo = {
      method: config.method || 'GET',
      url: url,
      endpoint: endpoint,
      headers: config.headers,
      body: config.body ? JSON.parse(config.body as string) : undefined,
      timestamp: new Date().toISOString(),
      description: this.getApiDescription(endpoint, config.method || 'GET')
    };

    console.log(`🔄 VAPI API Call:`, apiCallInfo);

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API Error:`, {
          ...apiCallInfo,
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log(`✅ API Success:`, {
        ...apiCallInfo,
        status: response.status,
        responseSize: JSON.stringify(data).length,
        resultCount: Array.isArray(data) ? data.length : 1
      });
      
      // Emit custom event for UI to capture
      window.dispatchEvent(new CustomEvent('vapiApiCall', { 
        detail: { 
          request: apiCallInfo, 
          response: { status: response.status, data },
          success: true
        } 
      }));
      
      return data;
    } catch (error) {
      console.error(`❌ Request failed:`, { ...apiCallInfo, error });
      
      // Emit error event for UI
      window.dispatchEvent(new CustomEvent('vapiApiCall', { 
        detail: { 
          request: apiCallInfo, 
          error: error,
          success: false
        } 
      }));
      
      throw error;
    }
  }

  private getApiDescription(endpoint: string, method: string): string {
    const key = `${method} ${endpoint.split('?')[0]}`;
    
    // Handle dynamic endpoints with IDs
    const dynamicDescriptions: Array<{pattern: RegExp, description: string}> = [
      { pattern: /^GET \/phone-number\?/, description: 'Fetch phone numbers with query parameters' },
      { pattern: /^DELETE \/phone-number\/[^\/]+$/, description: 'Delete specific phone number by ID' },
      { pattern: /^DELETE \/credential\/[^\/]+$/, description: 'Delete specific SIP trunk credential by ID' },
      { pattern: /^PATCH \/credential\/[^\/]+$/, description: 'Update specific SIP trunk credential by ID' },
      { pattern: /^GET \/call\/[^\/]+$/, description: 'Fetch specific call details by ID' },
      { pattern: /^DELETE \/assistant\/[^\/]+$/, description: 'Delete specific AI assistant by ID' },
    ];

    // Check dynamic patterns first
    for (const {pattern, description} of dynamicDescriptions) {
      if (pattern.test(key)) {
        return description;
      }
    }

    // Static endpoint descriptions
    const descriptions: Record<string, string> = {
      'GET /phone-number': 'Fetch all phone numbers from VAPI account',
      'POST /phone-number': 'Create new phone number and associate with SIP trunk',
      'DELETE /phone-number': 'Delete phone number from VAPI account',
      'GET /credential': 'Fetch all SIP trunk credentials from VAPI account',
      'POST /credential': 'Create new SIP trunk credential for call routing',
      'DELETE /credential': 'Delete SIP trunk credential from VAPI account',
      'PATCH /credential': 'Update existing SIP trunk credential settings',
      'GET /assistant': 'Fetch all AI assistants from VAPI account',
      'POST /assistant': 'Create new AI assistant with model and voice settings',
      'DELETE /assistant': 'Delete AI assistant from VAPI account',
      'POST /call': 'Initiate outbound phone call using VAPI AI assistant',
      'GET /call': 'Fetch call history and details from VAPI account'
    };

    return descriptions[key] || `${method} request to ${endpoint}`;
  }

  async getPhoneNumbers() {
    try {
      const response = await this.request('/phone-number');
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('Failed to fetch phone numbers:', error);
      return [];
    }
  }

    async makeCall(assistantId: string, phoneNumberId: string, customerNumber: string, customerName?: string, metadata?: Record<string, any>) {
    // First, ensure the assistant has monitoring enabled for WebSocket connections
    try {
      await this.enableAssistantMonitoring(assistantId);
      console.log(`✅ Monitoring enabled for assistant ${assistantId}`);
    } catch (error) {
      console.warn(`⚠️ Could not enable monitoring for assistant ${assistantId}:`, error);
    }

    const payload: any = {
      assistantId,
      phoneNumberId,
      customer: {
        number: customerNumber,
        name: customerName || 'Customer'
      }
    };

    // Add metadata if provided
    if (metadata && Object.keys(metadata).length > 0) {
      payload.metadata = metadata;
    }

    return this.request('/call', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // Credential Management
  async listCredentials() {
    return this.request('/credential');
  }

  async createCredential(credentialData: any) {
    return this.request('/credential', {
      method: 'POST',
      body: JSON.stringify(credentialData)
    });
  }

  async updateCredential(credentialId: string, credentialData: any) {
    // Note: VAPI API doesn't seem to support direct credential updates
    // This is a workaround - delete and recreate
    console.warn('VAPI does not support direct credential updates. Consider delete/recreate approach.');
    
    // Try PATCH first (in case it's supported but not documented)
    try {
      return this.request(`/credential/${credentialId}`, {
        method: 'PATCH',
        body: JSON.stringify(credentialData)
      });
    } catch (error) {
      console.error('PATCH failed, credential updates may not be supported:', error);
      throw new Error('Credential updates are not supported by VAPI API. Please delete and recreate the credential instead.');
    }
  }

  async deleteCredential(credentialId: string) {
    return this.request(`/credential/${credentialId}`, {
      method: 'DELETE'
    });
  }

  // Phone Number Management
  async createPhoneNumber(phoneNumberData: any) {
    return this.request('/phone-number', {
      method: 'POST',
      body: JSON.stringify(phoneNumberData)
    });
  }

  async deletePhoneNumber(phoneNumberId: string) {
    return this.request(`/phone-number/${phoneNumberId}`, {
      method: 'DELETE'
    });
  }

  async getPhoneNumbersByCredential(credentialId: string) {
    try {
      const allPhoneNumbers = await this.getPhoneNumbers();
      return allPhoneNumbers.filter((phone: any) => phone.credentialId === credentialId);
    } catch (error) {
      console.error('Failed to fetch phone numbers by credential:', error);
      return [];
    }
  }

  async getCall(callId: string) {
    return this.request(`/call/${callId}`);
  }

  async getAssistants() {
    try {
      const response = await this.request('/assistant');
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('Failed to fetch assistants:', error);
      return [];
    }
  }

  async getCredentials() {
    try {
      const response = await this.request('/credential');
      return Array.isArray(response) ? response : [];
    } catch (error) {
      console.error('Failed to fetch credentials:', error);
      return [];
    }
  }

  // Assistant Management
  async updateAssistant(assistantId: string, updates: any) {
    return this.request(`/assistant/${assistantId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  async enableAssistantMonitoring(assistantId: string, options: { listen?: boolean, control?: boolean } = {}) {
    const monitorPlan = {
      listenEnabled: options.listen !== false, // Default to true
      listenAuthenticationEnabled: false,
      controlEnabled: options.control !== false, // Default to true
      controlAuthenticationEnabled: false
    };

    return this.updateAssistant(assistantId, { monitorPlan });
  }

  async getAssistant(assistantId: string) {
    return this.request(`/assistant/${assistantId}`);
  }

  async verifyAssistantMonitoring(assistantId: string) {
    try {
      const assistant = await this.getAssistant(assistantId);
      const monitorPlan = assistant.monitorPlan || {};
      
      return {
        assistantId,
        assistantName: assistant.name,
        monitoring: {
          configured: !!assistant.monitorPlan,
          listenEnabled: monitorPlan.listenEnabled === true,
          controlEnabled: monitorPlan.controlEnabled === true,
          listenAuth: monitorPlan.listenAuthenticationEnabled === true,
          controlAuth: monitorPlan.controlAuthenticationEnabled === true
        },
        recommendation: this.getMonitoringRecommendation(monitorPlan)
      };
    } catch (error) {
      console.error(`Failed to verify monitoring for assistant ${assistantId}:`, error);
      throw error;
    }
  }

  private getMonitoringRecommendation(monitorPlan: any): string {
    if (!monitorPlan) {
      return "Enable monitoring plan to get WebSocket URLs for real-time call monitoring";
    }
    
    if (!monitorPlan.listenEnabled && !monitorPlan.controlEnabled) {
      return "Enable listening or control features for WebSocket connectivity";
    }
    
    if (monitorPlan.listenEnabled && monitorPlan.controlEnabled) {
      return "Monitoring fully configured - WebSocket connections should work";
    }
    
    if (monitorPlan.listenEnabled) {
      return "Listen monitoring enabled - control monitoring can also be enabled";
    }
    
    return "Control monitoring enabled - listen monitoring can also be enabled";
  }
}

export const vapiService = new VapiService();