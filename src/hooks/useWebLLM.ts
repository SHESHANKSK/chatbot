import { useState, useEffect, useCallback, useRef } from 'react';
import * as webllm from '@mlc-ai/web-llm';

export interface LLMLoadingState {
  isLoading: boolean;
  progress: number;
  stage: string;
  error: string | null;
  isReady: boolean;
}

export interface LLMGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface UseWebLLMReturn {
  loadingState: LLMLoadingState;
  generateResponse: (prompt: string, options?: LLMGenerationOptions) => Promise<string>;
  isGenerating: boolean;
  initializeLLM: () => Promise<void>;
  resetLLM: () => void;
}

/**
 * Custom hook for managing WebLLM integration
 * Handles model loading, initialization, and text generation
 */
export function useWebLLM(): UseWebLLMReturn {
  const [loadingState, setLoadingState] = useState<LLMLoadingState>({
    isLoading: false,
    progress: 0,
    stage: '',
    error: null,
    isReady: false
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const engineRef = useRef<webllm.MLCEngine | null>(null);
  const initializationRef = useRef<Promise<void> | null>(null);

  /**
   * Initialize the WebLLM engine with a lightweight model
   */
  const initializeLLM = useCallback(async () => {
    // Prevent multiple simultaneous initializations
    if (initializationRef.current) {
      return initializationRef.current;
    }

    if (engineRef.current) {
      console.log('LLM already initialized');
      return;
    }

    const initPromise = (async () => {
      try {
        setLoadingState(prev => ({
          ...prev,
          isLoading: true,
          progress: 0,
          stage: 'Initializing WebLLM...',
          error: null
        }));

        // Create engine with progress callback
        const engine = new webllm.MLCEngine();
        
        // Set up progress tracking
        engine.setInitProgressCallback((report: webllm.InitProgressReport) => {
          setLoadingState(prev => ({
            ...prev,
            progress: Math.round(report.progress * 100),
            stage: report.text || 'Loading model...'
          }));
        });

        // Initialize with a lightweight model
        // Using Phi-3-mini-4k-instruct-q4f16_1-MLC as it's one of the smaller available models
        await engine.reload('Phi-3-mini-4k-instruct-q4f16_1-MLC');
        
        engineRef.current = engine;
        
        setLoadingState(prev => ({
          ...prev,
          isLoading: false,
          progress: 100,
          stage: 'Model ready!',
          isReady: true
        }));

        console.log('WebLLM initialized successfully');
        
      } catch (error) {
        console.error('Failed to initialize WebLLM:', error);
        setLoadingState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to initialize LLM',
          isReady: false
        }));
        engineRef.current = null;
      }
    })();

    initializationRef.current = initPromise;
    return initPromise;
  }, []);

  /**
   * Generate a response using the loaded LLM
   */
  const generateResponse = useCallback(async (
    prompt: string, 
    options: LLMGenerationOptions = {}
  ): Promise<string> => {
    if (!engineRef.current) {
      throw new Error('LLM not initialized. Please initialize first.');
    }

    if (isGenerating) {
      throw new Error('Already generating a response. Please wait.');
    }

    setIsGenerating(true);

    try {
      const {
        temperature = 0.7,
        maxTokens = 512,
        topP = 0.9
      } = options;

      // Create chat completion request
      const messages: webllm.ChatCompletionMessageParam[] = [
        {
          role: 'user',
          content: prompt
        }
      ];

      const response = await engineRef.current.chat.completions.create({
        messages,
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        stream: false // For simplicity, we'll use non-streaming for now
      });

      const generatedText = response.choices[0]?.message?.content || '';
      
      if (!generatedText) {
        throw new Error('No response generated from LLM');
      }

      return generatedText;

    } catch (error) {
      console.error('Error generating response:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to generate response');
    } finally {
      setIsGenerating(false);
    }
  }, [isGenerating]);

  /**
   * Reset the LLM engine
   */
  const resetLLM = useCallback(() => {
    if (engineRef.current) {
      // Note: WebLLM doesn't have a direct cleanup method in the current API
      // We'll just reset our references
      engineRef.current = null;
    }
    
    initializationRef.current = null;
    
    setLoadingState({
      isLoading: false,
      progress: 0,
      stage: '',
      error: null,
      isReady: false
    });
    
    setIsGenerating(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetLLM();
    };
  }, [resetLLM]);

  return {
    loadingState,
    generateResponse,
    isGenerating,
    initializeLLM,
    resetLLM
  };
}