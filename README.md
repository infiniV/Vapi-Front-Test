# VAPI Call Monitor

A Next.js application for monitoring and managing VAPI (Voice AI API) calls with real-time WebSocket integration and SIP trunk management.

## Features

### 🚀 Core Functionality
- **Make Outbound Calls**: Place calls using VAPI assistants and phone numbers
- **Real-time Monitoring**: Live call status updates via WebSocket
- **SIP Trunk Management**: Create, view, and edit SIP trunk credentials
- **Phone Number Management**: View and select from available phone numbers
- **Call Analytics**: View call costs, transcripts, and recordings

### 📊 SIP Trunk Features
- **Create SIP Credentials**: Add new SIP trunk credentials with gateway configuration
- **Edit Gateway IP**: Update SIP gateway IP addresses directly from the UI  
- **Inbound/Outbound Control**: Configure direction settings for each gateway
- **Authentication Setup**: Configure outbound authentication usernames
- **Real-time Updates**: Live credential management without page refresh

### 🔧 Technical Features
- **API Request/Response Display**: See exactly what's being sent to VAPI API
- **WebSocket Connection**: Real-time call events and transcript updates
- **Error Handling**: Comprehensive error reporting and validation
- **Responsive Design**: Works on desktop and mobile devices

## Prerequisites

Before running this application, ensure you have:

1. **Node.js** (v18 or higher)
2. **npm** or **yarn**
3. **VAPI Account** with:
   - API Key
   - Configured phone numbers
   - At least one assistant

## Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Setup**:
   Create or update the `.env.local` file in the root directory:
   ```bash
   # VAPI Configuration
   NEXT_PUBLIC_VAPI_API_KEY=your_vapi_api_key_here
   NEXT_PUBLIC_VAPI_BASE_URL=https://api.vapi.ai
   ```

3. **Get your VAPI API Key**:
   - Log in to your VAPI dashboard
   - Navigate to API Keys section
   - Create or copy an existing API key
   - Replace `your_vapi_api_key_here` in `.env.local`

## Configuration

### Required VAPI Setup

Before using this application, you need to have the following configured in your VAPI account:

1. **SIP Trunk Credential** (if using BYO SIP):
   ```bash
   curl -X POST "https://api.vapi.ai/credential" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "provider": "byo-sip-trunk",
       "name": "My SIP Trunk",
       "gateways": [{"ip": "YOUR_SIP_SERVER_IP", "inboundEnabled": true}],
       "outboundAuthenticationPlan": {"authUsername": "your_username"}
     }'
   ```

2. **Phone Numbers**:
   ```bash
   curl -X POST "https://api.vapi.ai/phone-number" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "provider": "byo-phone-number",
       "name": "My Phone Number",
       "number": "YOUR_PHONE_NUMBER",
       "numberE164CheckEnabled": false,
       "credentialId": "YOUR_CREDENTIAL_ID"
     }'
   ```

3. **Assistant**:
   ```bash
   curl -X POST "https://api.vapi.ai/assistant" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "My Assistant",
       "model": {"provider": "openai", "model": "gpt-3.5-turbo"},
       "voice": {"provider": "eleven-labs", "voiceId": "pNInz6obpgDQGcFmaJgB"},
       "firstMessage": "Hello, how can I help you today?"
     }'
   ```

## Running the Application

1. **Development Mode**:
   ```bash
   npm run dev
   ```

2. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

3. **Production Build**:
   ```bash
   npm run build
   npm start
   ```

## How to Use

### SIP Trunk Management

Before making calls, you need to configure SIP trunk credentials:

1. **Create SIP Credential**:
   - Click "Add New" in the SIP Trunk Management section
   - Enter a name for your credential (e.g., "My SIP Trunk")
   - Add your SIP gateway IP address
   - Optionally add authentication username
   - Configure inbound/outbound settings
   - Click "Create Credential"

2. **Edit Gateway IP**:
   - Find your credential in the list
   - Click "Edit" next to the gateway IP
   - Enter the new IP address
   - Click "Save" (Note: This will delete and recreate the credential due to VAPI API limitations)

3. **Select Credential**:
   - Click on any credential card to select it
   - Selected credentials are highlighted with a blue border

### Making a Call

1. **Enter Assistant ID**: Paste your VAPI assistant ID in the form
2. **Select Phone Number**: Choose from available phone numbers in your account
3. **Enter Target Number**: Input the destination phone number (E.164 format recommended)
4. **Click "Make Call"**: Initiate the call

### Monitoring the Call

Once a call is initiated:

- **API Details**: View the exact request sent and response received
- **Call Status**: Real-time status updates (queued → ringing → in-progress → ended)
- **WebSocket Monitor**: Live updates including:
  - Call state changes
  - Transcript updates
  - Cost information
  - Call end reasons

### WebSocket Events

The application connects to VAPI's WebSocket endpoint automatically when a call is made. You'll see real-time events including:

- Connection status
- Call status updates
- Transcript messages
- Cost updates
- Error messages

## API Endpoints Used

This application interacts with the following VAPI endpoints:

- `GET /phone-number` - List available phone numbers
- `POST /call` - Initiate outbound calls
- `GET /call/{id}` - Get call details
- WebSocket connections via monitor URLs

## Troubleshooting

### Common Issues

1. **"No phone numbers configured"**:
   - Ensure you have phone numbers set up in your VAPI account
   - Check your API key has the correct permissions

2. **"Failed to make call"**:
   - Verify your assistant ID is correct
   - Ensure the target phone number is in valid E.164 format
   - Check your VAPI account has sufficient credits

3. **WebSocket connection fails**:
   - This is normal for some call types
   - WebSocket URLs are only provided for certain call configurations

4. **API key errors**:
   - Verify your API key is correctly set in `.env.local`
   - Ensure the API key has the necessary permissions

5. **SIP Trunk Issues**:
   - Ensure your SIP gateway IP is correct and accessible
   - Check that inbound/outbound settings match your SIP server configuration
   - Verify authentication credentials if using outbound auth
   - Make sure your SIP server is configured to accept connections from VAPI
   - **Note**: Credential updates require delete/recreate due to VAPI API limitations

### Debug Mode

To enable detailed logging:

1. Open browser developer tools (F12)
2. Check the Console tab for detailed API request/response logs
3. All VAPI API calls are logged with full details

## Technology Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - UI components
- **VAPI API** - Voice AI platform integration

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Main page
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── vapi-call-monitor.tsx     # Main application component
│   └── sip-trunk-manager.tsx     # SIP trunk management component
└── lib/
    ├── utils.ts                  # Utility functions
    └── vapi-service.ts           # VAPI API service
```

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is for demonstration purposes. Please ensure compliance with VAPI's terms of service when using their API.
# Vapi-Front-Test
