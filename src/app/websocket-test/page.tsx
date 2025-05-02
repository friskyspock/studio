'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function WebSocketTest() {
  const [serverStatus, setServerStatus] = useState<'checking' | 'up' | 'down'>('checking');
  const [statusMessage, setStatusMessage] = useState('Checking WebSocket server...');
  const [wsUrl, setWsUrl] = useState('');
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const [connectionLog, setConnectionLog] = useState<string[]>([]);

  const checkServer = async () => {
    try {
      setServerStatus('checking');
      setStatusMessage('Checking WebSocket server...');
      
      const response = await fetch('/api/websocket-check');
      const data = await response.json();
      
      if (data.status === 'success') {
        setServerStatus('up');
        setStatusMessage(`Server appears to be running: ${data.message}`);
        setWsUrl(data.wsUrl);
      } else {
        setServerStatus('down');
        setStatusMessage(`Server appears to be down: ${data.message}`);
      }
      
      addToLog(`Server check result: ${data.status} - ${data.message}`);
    } catch (error) {
      setServerStatus('down');
      setStatusMessage(`Error checking server: ${error instanceof Error ? error.message : String(error)}`);
      addToLog(`Error checking server: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const testWebSocketConnection = () => {
    try {
      setConnectionAttempts(prev => prev + 1);
      const attemptNumber = connectionAttempts + 1;
      
      addToLog(`Attempt #${attemptNumber}: Connecting to WebSocket at ${wsUrl}...`);
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        addToLog(`Attempt #${attemptNumber}: Connection SUCCESSFUL!`);
        setTimeout(() => {
          addToLog(`Attempt #${attemptNumber}: Closing connection after 2 seconds`);
          ws.close();
        }, 2000);
      };
      
      ws.onclose = (event) => {
        addToLog(`Attempt #${attemptNumber}: Connection closed. Code: ${event.code}, Reason: ${event.reason || 'No reason provided'}, Clean: ${event.wasClean}`);
      };
      
      ws.onerror = (error) => {
        addToLog(`Attempt #${attemptNumber}: Connection ERROR: ${error}`);
      };
    } catch (error) {
      addToLog(`Attempt #${connectionAttempts + 1}: Error creating WebSocket: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const addToLog = (message: string) => {
    const timestamp = new Date().toISOString();
    setConnectionLog(prev => [`[${timestamp}] ${message}`, ...prev]);
  };

  useEffect(() => {
    checkServer();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>WebSocket Connection Test</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div 
                className={`w-3 h-3 rounded-full ${
                  serverStatus === 'up' ? 'bg-green-500' : 
                  serverStatus === 'down' ? 'bg-red-500' : 'bg-yellow-500'
                }`} 
              />
              <span>{statusMessage}</span>
            </div>
            <div className="mb-2">
              <strong>WebSocket URL:</strong> {wsUrl || 'Not available'}
            </div>
            <div className="mb-4">
              <strong>Connection Attempts:</strong> {connectionAttempts}
            </div>
            <div className="flex gap-2">
              <Button onClick={checkServer}>Check Server</Button>
              <Button onClick={testWebSocketConnection} disabled={serverStatus !== 'up'}>
                Test Connection
              </Button>
            </div>
          </div>
          
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2">Connection Log</h3>
            <div className="bg-gray-100 p-3 rounded-md h-80 overflow-y-auto">
              {connectionLog.length === 0 ? (
                <p className="text-gray-500">No connection attempts yet</p>
              ) : (
                <pre className="text-xs whitespace-pre-wrap">
                  {connectionLog.join('\n')}
                </pre>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
