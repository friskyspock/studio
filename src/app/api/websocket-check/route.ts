import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Try to connect to the WebSocket server
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:5001/p1/ws';
    const httpUrl = wsUrl.replace('ws://', 'http://').replace('wss://', 'https://');
    
    console.log(`[${new Date().toISOString()}] Checking WebSocket server at: ${wsUrl} (HTTP check: ${httpUrl})`);
    
    // Try to make an HTTP request to the server (not the WebSocket endpoint)
    // This is just to check if the server is running
    const baseUrl = httpUrl.split('/').slice(0, 3).join('/');
    const response = await fetch(baseUrl, { method: 'GET' });
    
    return NextResponse.json({
      status: 'success',
      message: `WebSocket server appears to be running. HTTP response status: ${response.status}`,
      wsUrl,
      httpUrl,
      baseUrl,
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error checking WebSocket server:`, error);
    return NextResponse.json({
      status: 'error',
      message: 'WebSocket server appears to be down or unreachable',
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
