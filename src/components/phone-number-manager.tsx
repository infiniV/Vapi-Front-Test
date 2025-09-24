'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { vapiService } from '@/lib/vapi-service'
import { formatPhoneNumber } from '@/lib/utils'

interface PhoneNumber {
  id: string
  name: string
  number: string
  provider: string
  status: string
  credentialId: string
  numberE164CheckEnabled: boolean
  createdAt: string
  updatedAt: string
}

interface PhoneNumberManagerProps {
  credentialId: string
  credentialName: string
  onPhoneNumbersChange?: () => void
}

export function PhoneNumberManager({ credentialId, credentialName, onPhoneNumbersChange }: PhoneNumberManagerProps) {
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    number: '',
    numberE164CheckEnabled: false
  })

  useEffect(() => {
    if (credentialId) {
      fetchPhoneNumbers()
    }
  }, [credentialId])

  const fetchPhoneNumbers = async () => {
    if (!credentialId) return
    
    setLoading(true)
    try {
      const numbers = await vapiService.getPhoneNumbersByCredential(credentialId)
      setPhoneNumbers(numbers)
    } catch (error) {
      console.error('Failed to fetch phone numbers:', error)
    } finally {
      setLoading(false)
    }
  }

  const createPhoneNumber = async () => {
    if (!formData.name || !formData.number) {
      alert('Please fill in name and phone number')
      return
    }

    setCreating(true)
    try {
      const phoneNumberData = {
        provider: 'byo-phone-number',
        name: formData.name,
        number: formData.number,
        numberE164CheckEnabled: formData.numberE164CheckEnabled,
        credentialId: credentialId
      }

      console.log('📞 Creating Phone Number:', {
        api: 'POST /phone-number',
        description: `Associate phone number ${formData.number} with SIP trunk credential`,
        payload: phoneNumberData,
        credentialId: credentialId,
        credentialName: credentialName
      })

      await vapiService.createPhoneNumber(phoneNumberData)
      
      // Reset form
      setFormData({
        name: '',
        number: '',
        numberE164CheckEnabled: false
      })
      setShowAddForm(false)
      
      // Refresh list
      await fetchPhoneNumbers()
      onPhoneNumbersChange?.()
    } catch (error) {
      console.error('Failed to create phone number:', error)
      alert('Failed to create phone number')
    } finally {
      setCreating(false)
    }
  }

  const deletePhoneNumber = async (phoneNumberId: string, phoneNumber: string) => {
    const confirmed = confirm(`Are you sure you want to delete phone number ${phoneNumber}?`)
    if (!confirmed) return

    try {
      await vapiService.deletePhoneNumber(phoneNumberId)
      await fetchPhoneNumbers()
      onPhoneNumbersChange?.()
    } catch (error) {
      console.error('Failed to delete phone number:', error)
      alert('Failed to delete phone number')
    }
  }

  if (!credentialId) {
    return (
      <div className="text-center py-4 text-gray-500">
        Select a SIP trunk credential to manage phone numbers
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h4 className="text-md font-semibold">Phone Numbers</h4>
          <p className="text-sm text-gray-600">for {credentialName}</p>
        </div>
        <Button 
          onClick={() => setShowAddForm(!showAddForm)}
          variant="outline"
          size="sm"
        >
          {showAddForm ? 'Cancel' : 'Add Number'}
        </Button>
      </div>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add Phone Number</CardTitle>
            <CardDescription>
              Associate a new phone number with this SIP trunk
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="phone-name">Display Name</Label>
                <Input
                  id="phone-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My Phone Number"
                />
              </div>
              <div>
                <Label htmlFor="phone-number">Phone Number</Label>
                <Input
                  id="phone-number"
                  value={formData.number}
                  onChange={(e) => setFormData(prev => ({ ...prev, number: e.target.value }))}
                  placeholder="+1234567890"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="e164-check"
                checked={formData.numberE164CheckEnabled}
                onChange={(e) => setFormData(prev => ({ ...prev, numberE164CheckEnabled: e.target.checked }))}
              />
              <Label htmlFor="e164-check">Enable E164 format validation</Label>
            </div>

            <Button 
              onClick={createPhoneNumber} 
              disabled={creating}
              className="w-full"
            >
              {creating ? 'Adding...' : 'Add Phone Number'}
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-4">Loading phone numbers...</div>
      ) : (
        <div className="space-y-2">
          {phoneNumbers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No phone numbers associated with this credential.
            </div>
          ) : (
            phoneNumbers.map((phone) => (
              <Card key={phone.id} className="p-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h5 className="font-semibold">{phone.name}</h5>
                    <p className="text-lg font-mono">{formatPhoneNumber(phone.number)}</p>
                    <p className="text-xs text-gray-600">ID: {phone.id}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant={phone.status === "active" ? "default" : "secondary"}>
                        {phone.status}
                      </Badge>
                      <Badge variant="outline">{phone.provider}</Badge>
                      {phone.numberE164CheckEnabled && (
                        <Badge variant="outline">E164</Badge>
                      )}
                    </div>
                  </div>
                  
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => deletePhoneNumber(phone.id, phone.number)}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}