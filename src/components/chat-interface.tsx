
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Mic, Send, Square, Volume2, Loader2 } from 'lucide-react';
import ChatMessage, { type Message } from './chat-message';
import { useWebSocket, WebSocketStatus } from '@/hooks/use-websocket';
import { useMediaRecorder, RecordingStatus } from '@/hooks/use-media-recorder';
import { textToSpeech } from '@/services/eleven-labs'; // Assuming this path
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// --- Configuration ---
// Replace with your actual WebSocket endpoint URL
const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080'; // Default for local dev
// Replace with your actual ElevenLabs API Key and Voice ID
const ELEVENLABS_API_KEY = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '';
const ELEVENLABS_VOICE_ID = process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Example Voice ID

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [isProcessingSpeech, setIsProcessingSpeech] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  // --- WebSocket Hook ---
  const { status: wsStatus, sendMessage: sendWsMessage } = useWebSocket({
    url: WEBSOCKET_URL,
    onMessage: (event) => {
      try {
        const receivedText = event.data as string;
         console.log("AI Response Raw:", receivedText);
        // Assuming backend sends plain text response
        const newMessage: Message = {
          id: crypto.randomUUID(),
          text: receivedText,
          sender: 'ai',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, newMessage]);
        handlePlayAudio(receivedText);
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
        toast({
          title: "Message Error",
          description: "Received an invalid message from the server.",
          variant: "destructive",
        });
      }
    },
    onError: (event) => {
      console.error('WebSocket Error:', event);
      toast({
        title: "Connection Error",
        description: "An error occurred with the WebSocket connection.",
        variant: "destructive",
      });
    },
    onClose: (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      if (!event.wasClean) {
         toast({
            title: "Connection Lost",
            description: "WebSocket connection closed unexpectedly.",
            variant: "destructive",
          });
      }
    },
    onOpen: () => {
      console.log('WebSocket connection established.');
       toast({
            title: "Connected",
            description: "Successfully connected to the AI agent.",
        });
    }
  });

  // --- Media Recorder Hook ---
  const { status: recStatus, startRecording, stopRecording, getMediaStream } = useMediaRecorder({
    onRecordingComplete: async (blob) => {
      console.log('Recording complete, blob size:', blob.size);
      setIsProcessingSpeech(true);
      try {
        // --- Placeholder for Speech-to-Text API Call ---
        // Replace this with your actual STT API call
        console.log('Sending audio blob for transcription (placeholder)...');
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        const transcript = "This is a simulated transcript of your speech."; // Replace with actual transcript
        console.log('Received transcript (placeholder):', transcript);
        // --- End Placeholder ---

        handleSendMessage(transcript);
      } catch (error) {
        console.error('Error during Speech-to-Text:', error);
        toast({
          title: "Transcription Error",
          description: "Failed to convert speech to text.",
          variant: "destructive",
        });
      } finally {
        setIsProcessingSpeech(false);
      }
    },
    onError: (error) => {
      console.error('MediaRecorder Error:', error);
      // Toast is handled within the hook, but you could add more here
      setIsProcessingSpeech(false); // Ensure loading state is reset
    },
    // Consider a more widely supported format if needed
    // mimeType: 'audio/mp3',
  });

  // --- Text-to-Speech Handler ---
  const handlePlayAudio = async (text: string) => {
    if (!text || !ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
        console.warn("Skipping TTS: Missing text or ElevenLabs config.");
        return;
    }
    if (isAiSpeaking) {
        console.log("AI is already speaking, queuing next utterance.");
        // Simple queue or just ignore for now
        return;
    }

    console.log("Requesting TTS for:", text);
    setIsAiSpeaking(true);
    try {
      const audioBlob = await textToSpeech(text, {
        apiKey: ELEVENLABS_API_KEY,
        voiceId: ELEVENLABS_VOICE_ID,
      });

      if (audioPlayerRef.current) {
        const audioUrl = URL.createObjectURL(audioBlob);
        audioPlayerRef.current.src = audioUrl;
        audioPlayerRef.current.play()
          .then(() => console.log("Audio playback started."))
          .catch(e => {
              console.error("Error playing audio:", e);
              toast({ title: "Playback Error", description: "Could not play AI response.", variant: "destructive"});
              setIsAiSpeaking(false); // Reset state on playback error
          });

        // Event listener for when audio finishes playing
        const onEnded = () => {
          console.log("Audio playback finished.");
          setIsAiSpeaking(false);
          URL.revokeObjectURL(audioUrl); // Clean up the object URL
          audioPlayerRef.current?.removeEventListener('ended', onEnded);
          audioPlayerRef.current?.removeEventListener('error', onError);
        };
        const onError = (e: Event) => {
            console.error("Audio element error:", e);
            setIsAiSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            toast({ title: "Playback Error", description: "An error occurred during audio playback.", variant: "destructive"});
            audioPlayerRef.current?.removeEventListener('ended', onEnded);
            audioPlayerRef.current?.removeEventListener('error', onError);
        }
        audioPlayerRef.current.addEventListener('ended', onEnded);
        audioPlayerRef.current.addEventListener('error', onError);
      }
    } catch (error) {
      console.error('Error fetching or playing TTS audio:', error);
      toast({
        title: "Text-to-Speech Error",
        description: "Failed to generate or play audio response.",
        variant: "destructive",
      });
      setIsAiSpeaking(false); // Reset state on TTS error
    }
  };

  // --- Send Message Handler ---
  const handleSendMessage = (text?: string) => {
    const messageText = text ?? inputValue;
    if (!messageText.trim() || wsStatus !== WebSocketStatus.Open) {
        if (wsStatus !== WebSocketStatus.Open) {
            toast({ title: "Not Connected", description: "Cannot send message, not connected.", variant: "destructive"})
        }
      return;
    }

    const newMessage: Message = {
      id: crypto.randomUUID(),
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    sendWsMessage(messageText); // Send text via WebSocket
    setInputValue('');
  };

  // --- Input and Button Handlers ---
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleMicClick = async () => {
     if (recStatus === RecordingStatus.Idle || recStatus === RecordingStatus.Stopped || recStatus === RecordingStatus.Error || recStatus === RecordingStatus.PermissionDenied) {
        // Attempt to get stream first if denied or not yet initialized
        if (recStatus === RecordingStatus.PermissionDenied || !mediaStreamRef.current) {
            const stream = await getMediaStream();
            if (stream) { // If permission granted now, start recording
               startRecording();
            }
            // If stream is null, error/denial already handled by getMediaStream
        } else {
            startRecording();
        }
    } else if (recStatus === RecordingStatus.Recording) {
      stopRecording();
    }
    // Ignore clicks during 'requesting', 'stopping'
  };

  // --- Auto-scroll ---
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

   // --- Initial Permission Check ---
  useEffect(() => {
    // Optional: Check/request permission on load, or wait for first mic click
    // getMediaStream(); // Uncomment to request on load
  }, [getMediaStream]);

  // --- Determine Button States ---
  const isRecording = recStatus === RecordingStatus.Recording;
  const isMicDisabled = recStatus === RecordingStatus.RequestingPermission ||
                        recStatus === RecordingStatus.Stopping ||
                        isProcessingSpeech || // Disable mic while processing STT
                        wsStatus !== WebSocketStatus.Open; // Disable if not connected
  const isSendDisabled = !inputValue.trim() || wsStatus !== WebSocketStatus.Open;


  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg flex flex-col h-[80vh] min-h-[400px]">
      <CardHeader className="border-b">
        <CardTitle className="text-primary flex items-center justify-between">
          <span>VocalLink AI</span>
           <span className={cn(
               "text-xs font-normal px-2 py-1 rounded",
               wsStatus === WebSocketStatus.Open && "bg-green-100 text-green-800",
               wsStatus === WebSocketStatus.Connecting && "bg-yellow-100 text-yellow-800",
               (wsStatus === WebSocketStatus.Closed || wsStatus === WebSocketStatus.Error || wsStatus === WebSocketStatus.Closing) && "bg-red-100 text-red-800"
           )}>
               {wsStatus}
           </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground mt-4">
              Start the conversation by typing or using the microphone.
            </p>
          ) : (
            messages.map((msg) => <ChatMessage key={msg.id} message={msg} />)
          )}
           {isAiSpeaking && (
              <div className="flex items-center justify-start gap-2 my-4 pl-12 animate-pulse">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">AI is speaking...</span>
              </div>
          )}
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t">
        <div className="flex w-full items-center gap-2">
          <Input
            type="text"
            placeholder={isRecording ? "Recording..." : "Type your message..."}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isRecording || wsStatus !== WebSocketStatus.Open}
            className="flex-1"
          />
          <Button
            size="icon"
            variant={isRecording ? "destructive" : "outline"}
            onClick={handleMicClick}
            disabled={isMicDisabled}
            aria-label={isRecording ? "Stop recording" : "Start recording"}
            className={cn(isRecording && "animate-pulse")}
          >
            {isProcessingSpeech ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isRecording ? (
              <Square className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
          <Button
             size="icon"
             onClick={() => handleSendMessage()}
             disabled={isSendDisabled || isRecording}
             aria-label="Send message"
           >
            <Send className="h-4 w-4" />
          </Button>
        </div>
         {/* Hidden Audio Player */}
         <audio ref={audioPlayerRef} className="hidden" />
         {(recStatus === RecordingStatus.PermissionDenied) && (
             <p className="text-xs text-destructive w-full text-center mt-2">
                 Microphone access denied. Please enable it in browser settings.
             </p>
         )}
      </CardFooter>
    </Card>
  );
};

export default ChatInterface;
