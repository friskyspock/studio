
/**
 * Configuration options for the ElevenLabs API.
 */
export interface ElevenLabsOptions {
  /**
   * The API key for accessing the ElevenLabs service.
   * IMPORTANT: Keep your API key secure. Avoid committing it directly into your codebase.
   * Consider using environment variables.
   */
  apiKey: string;
  /**
   * The ID of the voice to use for text-to-speech.
   * You can find voice IDs in your ElevenLabs dashboard.
   */
  voiceId: string;
  /**
   * Optional model ID. Defaults to 'eleven_multilingual_v2' if not provided.
   */
  modelId?: string;
   /**
   * Optional voice settings. See ElevenLabs documentation for details.
   * e.g., { stability: 0.5, similarity_boost: 0.75 }
   */
  voiceSettings?: Record<string, number>;
}

/**
 * Asynchronously converts text to speech using the ElevenLabs API.
 *
 * @param text The text to convert to speech. Maximum 5000 characters for non-subscribed users.
 * @param options Configuration options for the ElevenLabs API.
 * @returns A promise that resolves to an audio Blob containing the speech (typically audio/mpeg).
 * @throws {Error} If the API request fails or returns an error status.
 */
export async function textToSpeech(text: string, options: ElevenLabsOptions): Promise<Blob> {
  const { apiKey, voiceId, modelId = 'eleven_multilingual_v2', voiceSettings } = options;

  if (!apiKey) {
    throw new Error('ElevenLabs API key is required.');
  }
  if (!voiceId) {
    throw new Error('ElevenLabs Voice ID is required.');
  }
  if (!text) {
    // Return an empty blob or throw an error if text is empty
     console.warn('textToSpeech called with empty text.');
     return new Blob([], { type: 'audio/mpeg' });
  }

  const apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const body = JSON.stringify({
    text: text,
    model_id: modelId,
    ...(voiceSettings && { voice_settings: voiceSettings }), // Conditionally add voice_settings
  });

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: body,
    });

    if (!response.ok) {
      // Attempt to read error details from the response body
      let errorDetails = `HTTP error! Status: ${response.status}`;
      try {
        const errorJson = await response.json();
         errorDetails += ` - ${errorJson.detail || JSON.stringify(errorJson)}`;
      } catch (error) {
        // If reading JSON fails, use the status text
        console.error('Error parsing JSON response:', error);
        errorDetails += ` - ${response.statusText}`;
      }
       console.error("ElevenLabs API Error:", errorDetails);
       throw error instanceof Error ? error : new Error(`HTTP error! Status: ${response.status}`);
    }
    
    // Check content type to ensure we received audio
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('audio/')) {
        throw new Error(`Expected audio content type, but received ${contentType}`);
    }

    const audioBlob = await response.blob();
    return audioBlob;
  } catch (e) {
    console.error('Error calling ElevenLabs API:', e);
    // Re-throw the error to be handled by the calling component
    throw e instanceof Error ? e : new Error('An unknown error occurred during text-to-speech.');
  }
}
