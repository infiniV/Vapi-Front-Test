"use client";

import { VapiCallMonitor } from "@/components/vapi-call-monitor";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4">
        <h1 className="text-3xl font-bold text-center mb-8">
          VAPI Call Monitor
        </h1>
        <VapiCallMonitor />
      </div>
    </div>
  );
}
