import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPhoneNumber(phoneNumber: string): string {
  // Remove all non-digit characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // If it starts with +, keep it, otherwise assume US number and add +1
  if (cleaned.startsWith('+')) {
    return cleaned;
  } else if (cleaned.length === 10) {
    return `+1${cleaned}`;
  } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `+${cleaned}`;
  }
  
  return `+1${cleaned}`;
}

export function validateE164PhoneNumber(phoneNumber: string): string {
  // Remove all formatting and spaces
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // If no country code, assume US (+1)
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) {
      cleaned = `+1${cleaned}`;
    } else if (cleaned.length === 11 && cleaned.startsWith('1')) {
      cleaned = `+${cleaned}`;
    } else {
      cleaned = `+1${cleaned}`;
    }
  }
  
  return cleaned;
}
