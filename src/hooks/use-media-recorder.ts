
"use client";

import { useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export enum RecordingStatus {
  Idle = 'idle',
  RequestingPermission = 'requesting_permission',
  PermissionDenied = 'permission_denied',
  Recording = 'recording',
  Stopping = 'stopping',
  Stopped = 'stopped',
  Error = 'error',
}

interface UseMediaRecorderOptions {
  onRecordingComplete?: (blob: Blob) => void;
  onError?: (error: Error) => void;
  mediaConstraints?: MediaStreamConstraints;
  mimeType?: string;
}

export function useMediaRecorder({
  onRecordingComplete,
  onError,
  mediaConstraints = { audio: true, video: false },
  mimeType = 'audio/webm', // Default, browser support varies
}: UseMediaRecorderOptions) {
  const [status, setStatus] = useState<RecordingStatus>(RecordingStatus.Idle);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const getMediaStream = useCallback(async (): Promise<MediaStream | null> => {
    if (mediaStreamRef.current) {
      return mediaStreamRef.current;
    }

    setStatus(RecordingStatus.RequestingPermission);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MediaDevices API not supported.');
      }
      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      mediaStreamRef.current = stream;
      setStatus(RecordingStatus.Idle); // Permission granted, ready to record
      console.log('Microphone access granted.');
      return stream;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to get media stream');
      console.error('Error accessing media devices.', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        setStatus(RecordingStatus.PermissionDenied);
        toast({
          title: "Microphone Access Denied",
          description: "Please enable microphone access in your browser settings.",
          variant: "destructive",
        });
      } else {
        setStatus(RecordingStatus.Error);
        toast({
          title: "Microphone Error",
          description: error.message || "Could not access the microphone.",
          variant: "destructive",
        });
      }
      if (onError) onError(error);
      return null;
    }
  }, [mediaConstraints, toast, onError]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
        console.log('Media stream stopped on unmount.');
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (status === RecordingStatus.Recording) {
      console.warn('Already recording.');
      return;
    }
     if (status === RecordingStatus.RequestingPermission) {
      console.warn('Still requesting permission.');
      return;
    }

    setAudioBlob(null); // Clear previous recording
    audioChunksRef.current = [];

    const stream = await getMediaStream();
    if (!stream) return; // Error handled within getMediaStream

    try {
        // Check if mimeType is supported
        let options = {};
        if (MediaRecorder.isTypeSupported(mimeType)) {
            options = { mimeType };
            console.log(`Using mimeType: ${mimeType}`);
        } else {
            console.warn(`MimeType ${mimeType} not supported, using default.`);
        }

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        console.log('Recording stopped.');
        const completeBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || mimeType });
        setAudioBlob(completeBlob);
        setStatus(RecordingStatus.Stopped);
        if (onRecordingComplete) {
          onRecordingComplete(completeBlob);
        }
        // Clean up tracks after stopping if desired, or keep stream for subsequent recordings
        // stream.getTracks().forEach(track => track.stop());
        // mediaStreamRef.current = null;
      };

      recorder.onerror = (event) => {
        const error = event instanceof ErrorEvent ? event.error : new Error('MediaRecorder error');
        console.error('MediaRecorder error:', error);
        setStatus(RecordingStatus.Error);
         toast({
            title: "Recording Error",
            description: error.message || "An error occurred during recording.",
            variant: "destructive",
          });
        if (onError) onError(error);
      };

      recorder.start();
      setStatus(RecordingStatus.Recording);
      console.log('Recording started.');

    } catch (err) {
       const error = err instanceof Error ? err : new Error('Failed to start recording');
      console.error('Error starting recording:', error);
      setStatus(RecordingStatus.Error);
      toast({
            title: "Recording Start Error",
            description: error.message || "Could not start recording.",
            variant: "destructive",
          });
      if (onError) onError(error);
      // Attempt to clean up stream if recording failed to start
      if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach(track => track.stop());
          mediaStreamRef.current = null;
      }
    }
  }, [status, getMediaStream, mimeType, onRecordingComplete, onError, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && status === RecordingStatus.Recording) {
      setStatus(RecordingStatus.Stopping);
      mediaRecorderRef.current.stop();
      // Status is set to Stopped in the onstop handler
    } else {
      console.warn('Not recording or recorder not initialized.');
    }
  }, [status]);

  return { status, startRecording, stopRecording, audioBlob, getMediaStream };
}
