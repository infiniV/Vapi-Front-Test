'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { vapiService } from '@/lib/vapi-service'
import { PhoneNumberManager } from './phone-number-manager'

interface SipGateway {
  ip: string
  inboundEnabled: boolean
  outboundEnabled?: boolean
}

interface SipCredential {
  id: string
  name: string
  provider: string
  gateways: SipGateway[]
  outboundAuthenticationPlan?: {
    authUsername: string
  }
  createdAt: string
  updatedAt: string
}

interface SipTrunkManagerProps {
  onCredentialSelect?: (credentialId: string) => void
}

export function SipTrunkManager({ onCredentialSelect }: SipTrunkManagerProps) {
  const [credentials, setCredentials] = useState<SipCredential[]>([])
  const [phoneNumberCounts, setPhoneNumberCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedCredential, setSelectedCredential] = useState<string>('')
  const [showPhoneNumbers, setShowPhoneNumbers] = useState<Record<string, boolean>>({})
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    gatewayIp: '',
    authUsername: '',
    inboundEnabled: true,
    outboundEnabled: true
  })

  useEffect(() => {
    fetchCredentials()
  }, [])

  const fetchCredentials = async () => {
    setLoading(true)
    try {
      const result = await vapiService.listCredentials()
      // Filter for SIP trunk credentials
      const sipCredentials = result.filter((cred: any) => cred.provider === 'byo-sip-trunk')
      setCredentials(sipCredentials)
      
      // Load phone number counts for each credential
      await loadPhoneNumberCounts(sipCredentials)
    } catch (error) {
      console.error('Failed to fetch credentials:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPhoneNumberCounts = async (credentialsList: SipCredential[]) => {
    const counts: Record<string, number> = {}
    
    for (const credential of credentialsList) {
      try {
        const phoneNumbers = await vapiService.getPhoneNumbersByCredential(credential.id)
        counts[credential.id] = phoneNumbers.length
      } catch (error) {
        console.error(`Failed to load phone numbers for credential ${credential.id}:`, error)
        counts[credential.id] = 0
      }
    }
    
    setPhoneNumberCounts(counts)
  }

  const handlePhoneNumbersChange = () => {
    // Refresh phone number counts when numbers are added/removed
    loadPhoneNumberCounts(credentials)
  }

  const togglePhoneNumbers = (credentialId: string) => {
    setShowPhoneNumbers(prev => ({
      ...prev,
      [credentialId]: !prev[credentialId]
    }))
  }

  const createCredential = async () => {
    if (!formData.name || !formData.gatewayIp) {
      alert('Please fill in name and gateway IP')
      return
    }

    setCreating(true)
    try {
      const credentialData = {
        provider: 'byo-sip-trunk',
        name: formData.name,
        gateways: [
          {
            ip: formData.gatewayIp,
            inboundEnabled: formData.inboundEnabled,
            outboundEnabled: formData.outboundEnabled
          }
        ],
        ...(formData.authUsername && {
          outboundAuthenticationPlan: {
            authUsername: formData.authUsername
          }
        })
      }

      console.log('📡 Creating SIP Trunk Credential:', {
        api: 'POST /credential',
        description: 'Create new SIP trunk credential for call routing',
        payload: credentialData
      })

      await vapiService.createCredential(credentialData)
      
      // Reset form
      setFormData({
        name: '',
        gatewayIp: '',
        authUsername: '',
        inboundEnabled: true,
        outboundEnabled: true
      })
      setShowCreateForm(false)
      
      // Refresh list
      await fetchCredentials()
    } catch (error) {
      console.error('Failed to create credential:', error)
      alert('Failed to create credential')
    } finally {
      setCreating(false)
    }
  }

  const updateGatewayIp = async (credentialId: string, newIp: string) => {
    if (!newIp) return

    try {
      const credential = credentials.find(c => c.id === credentialId)
      if (!credential) return

      // VAPI doesn't support direct credential updates
      // We need to delete and recreate the credential
      const updatedCredentialData = {
        provider: 'byo-sip-trunk',
        name: credential.name,
        gateways: [
          {
            ...credential.gateways[0],
            ip: newIp
          }
        ],
        ...(credential.outboundAuthenticationPlan && {
          outboundAuthenticationPlan: credential.outboundAuthenticationPlan
        })
      }

      // Delete the old credential
      await vapiService.deleteCredential(credentialId)
      
      // Create the new credential with updated IP
      await vapiService.createCredential(updatedCredentialData)
      
      // Refresh the list
      await fetchCredentials()
      
      alert('Credential updated successfully (recreated with new IP)')
    } catch (error) {
      console.error('Failed to update credential:', error)
      alert('Failed to update credential. VAPI may not support credential updates.')
    }
  }

  const handleCredentialSelect = (credentialId: string) => {
    setSelectedCredential(credentialId)
    onCredentialSelect?.(credentialId)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">SIP Trunk Credentials</h3>
        <Button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          variant="outline"
          size="sm"
        >
          {showCreateForm ? 'Cancel' : 'Add New'}
        </Button>
      </div>

      <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
        <strong>Note:</strong> Editing credentials will delete and recreate them with new settings due to VAPI API limitations.
      </div>

      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create SIP Trunk Credential</CardTitle>
            <CardDescription>
              Add a new SIP trunk credential for routing calls
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Credential Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My SIP Trunk"
                />
              </div>
              <div>
                <Label htmlFor="gatewayIp">Gateway IP Address</Label>
                <Input
                  id="gatewayIp"
                  value={formData.gatewayIp}
                  onChange={(e) => setFormData(prev => ({ ...prev, gatewayIp: e.target.value }))}
                  placeholder="192.168.1.100"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="authUsername">Auth Username (Optional)</Label>
              <Input
                id="authUsername"
                value={formData.authUsername}
                onChange={(e) => setFormData(prev => ({ ...prev, authUsername: e.target.value }))}
                placeholder="sip_username"
              />
            </div>

            <div className="flex gap-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.inboundEnabled}
                  onChange={(e) => setFormData(prev => ({ ...prev, inboundEnabled: e.target.checked }))}
                />
                <span>Inbound Enabled</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.outboundEnabled}
                  onChange={(e) => setFormData(prev => ({ ...prev, outboundEnabled: e.target.checked }))}
                />
                <span>Outbound Enabled</span>
              </label>
            </div>

            <Button 
              onClick={createCredential} 
              disabled={creating}
              className="w-full"
            >
              {creating ? 'Creating...' : 'Create Credential'}
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-4">Loading credentials...</div>
      ) : (
        <div className="space-y-2">
          {credentials.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No SIP trunk credentials found. Create one to get started.
            </div>
          ) : (
            credentials.map((credential) => (
              <CredentialCard 
                key={credential.id}
                credential={credential}
                phoneNumberCount={phoneNumberCounts[credential.id] || 0}
                isSelected={selectedCredential === credential.id}
                showPhoneNumbers={showPhoneNumbers[credential.id] || false}
                onSelect={() => handleCredentialSelect(credential.id)}
                onUpdateIp={(newIp) => updateGatewayIp(credential.id, newIp)}
                onTogglePhoneNumbers={() => togglePhoneNumbers(credential.id)}
                onPhoneNumbersChange={handlePhoneNumbersChange}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

interface CredentialCardProps {
  credential: SipCredential
  phoneNumberCount: number
  isSelected: boolean
  showPhoneNumbers: boolean
  onSelect: () => void
  onUpdateIp: (newIp: string) => void
  onTogglePhoneNumbers: () => void
  onPhoneNumbersChange: () => void
}

function CredentialCard({ 
  credential, 
  phoneNumberCount, 
  isSelected, 
  showPhoneNumbers, 
  onSelect, 
  onUpdateIp, 
  onTogglePhoneNumbers,
  onPhoneNumbersChange 
}: CredentialCardProps) {
  const [editing, setEditing] = useState(false)
  const [newIp, setNewIp] = useState(credential.gateways[0]?.ip || '')

  const handleUpdateIp = () => {
    onUpdateIp(newIp)
    setEditing(false)
  }

  return (
    <div className="space-y-2">
      <Card 
        className={`cursor-pointer transition-colors ${
          isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
        }`}
        onClick={onSelect}
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h4 className="font-semibold">{credential.name}</h4>
              <p className="text-sm text-gray-600">ID: {credential.id}</p>
              
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm">Gateway IP:</span>
                  {editing ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={newIp}
                        onChange={(e) => setNewIp(e.target.value)}
                        className="w-40 h-6 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Button 
                        size="sm" 
                        onClick={(e) => {
                          e.stopPropagation()
                          const confirmed = confirm(
                            'This will delete and recreate the credential with the new IP address. Continue?'
                          )
                          if (confirmed) {
                            handleUpdateIp()
                          }
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        Save
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditing(false)
                          setNewIp(credential.gateways[0]?.ip || '')
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                        {credential.gateways[0]?.ip}
                      </code>
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditing(true)
                        }}
                        className="h-6 px-2 text-xs"
                      >
                        Edit
                      </Button>
                    </div>
                  )}
                </div>
                
                {credential.outboundAuthenticationPlan?.authUsername && (
                  <div className="text-sm">
                    <span>Auth User: </span>
                    <code className="bg-gray-100 px-2 py-1 rounded">
                      {credential.outboundAuthenticationPlan.authUsername}
                    </code>
                  </div>
                )}
                
                <div className="flex gap-2 mt-2">
                  {credential.gateways[0]?.inboundEnabled && (
                    <Badge variant="secondary">Inbound</Badge>
                  )}
                  {credential.gateways[0]?.outboundEnabled && (
                    <Badge variant="secondary">Outbound</Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline">
                    {phoneNumberCount} Phone Number{phoneNumberCount !== 1 ? 's' : ''}
                  </Badge>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation()
                      onTogglePhoneNumbers()
                    }}
                    className="h-6 px-2 text-xs"
                  >
                    {showPhoneNumbers ? 'Hide' : 'Manage'} Numbers
                  </Button>
                </div>
              </div>
            </div>
            
            {isSelected && (
              <Badge variant="default">Selected</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {showPhoneNumbers && (
        <div className="ml-4">
          <PhoneNumberManager
            credentialId={credential.id}
            credentialName={credential.name}
            onPhoneNumbersChange={onPhoneNumbersChange}
          />
        </div>
      )}
    </div>
  )
}