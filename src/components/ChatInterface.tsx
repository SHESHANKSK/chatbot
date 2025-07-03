import React, { useState, useRef, useEffect } from 'react';
import { Send, MessageSquare, Clock, ExternalLink, AlertTriangle, Brain, Zap } from 'lucide-react';
import type { ChatMessage, VectorStore } from '../types';

interface ChatInterfaceProps {
  vectorStore: VectorStore | null;
  isDocumentLoaded: boolean;
  isProcessing: boolean;
  llmGenerateResponse?: (prompt: string) => Promise<string>;
  isLLMGenerating?: boolean;
}

export default function ChatInterface({ 
  vectorStore, 
  isDocumentLoaded, 
  isProcessing,
  llmGenerateResponse,
  isLLMGenerating = false
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isDocumentLoaded && !isProcessing) {
      // Add welcome message when document is ready
      if (messages.length === 0) {
        const welcomeMessage: ChatMessage = {
          id: 'welcome',
          type: 'assistant',
          content: llmGenerateResponse 
            ? 'Hello! I\'m ready to answer questions about your document using advanced AI. I can provide both direct quotes from the document and intelligent analysis based on the content.'
            : 'Hello! I\'m ready to answer questions about your document. I can only provide information that\'s explicitly contained in the PDF - I won\'t make up or infer information that isn\'t there.',
          timestamp: new Date(),
          isLLMGenerated: !!llmGenerateResponse
        };
        setMessages([welcomeMessage]);
      }
    }
  }, [isDocumentLoaded, isProcessing, messages.length, llmGenerateResponse]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim() || !vectorStore || isSearching || isLLMGenerating) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsSearching(true);

    const startTime = Date.now();

    try {
      // Perform similarity search
      const searchResults = await vectorStore.search(inputValue.trim(), 3);
      const processingTime = Date.now() - startTime;

      let responseContent: string;
      let sources = undefined;
      let isLLMGenerated = false;

      // Lowered similarity threshold from 0.1 to 0.05 for more forgiving search
      if (searchResults.length === 0 || searchResults[0].similarity < 0.05) {
        // No relevant information found
        responseContent = "I couldn't find information about that topic in the document. Please try rephrasing your question or ask about something else that might be covered in the PDF.";
      } else {
        // Filter results with meaningful similarity scores - lowered from 0.15 to 0.1
        const relevantResults = searchResults.filter(result => result.similarity > 0.1);
        
        if (relevantResults.length === 0) {
          responseContent = "I found some potentially related content, but it doesn't seem directly relevant to your question. Could you try asking more specifically about topics covered in the document?";
        } else {
          sources = relevantResults;

          // If LLM is available, use it to generate a more intelligent response
          if (llmGenerateResponse) {
            try {
              // Construct context from retrieved chunks
              const context = relevantResults
                .slice(0, 2) // Use top 2 most relevant chunks
                .map(result => result.chunk.text)
                .join('\n\n');

              // Create a prompt for the LLM
              const prompt = `Based on the following context from a document, please answer the user's question. Only use information that is explicitly stated in the context. If the context doesn't contain enough information to answer the question, say so.

Context:
${context}

Question: ${inputValue.trim()}

Answer:`;

              responseContent = await llmGenerateResponse(prompt);
              isLLMGenerated = true;
            } catch (llmError) {
              console.error('LLM generation failed, falling back to retrieval:', llmError);
              // Fall back to simple retrieval
              const topResult = relevantResults[0];
              if (topResult.relevantSentences.length > 0) {
                responseContent = topResult.relevantSentences.join(' ');
              } else {
                responseContent = topResult.chunk.text;
              }
            }
          } else {
            // Use simple retrieval approach
            const topResult = relevantResults[0];
            if (topResult.relevantSentences.length > 0) {
              responseContent = topResult.relevantSentences.join(' ');
            } else {
              responseContent = topResult.chunk.text;
            }
            
            // Add context if multiple results are highly relevant
            if (relevantResults.length > 1 && relevantResults[1].similarity > 0.2) {
              responseContent += '\n\nAdditional context:\n' + relevantResults[1].chunk.text;
            }
          }
        }
      }

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        content: responseContent,
        timestamp: new Date(),
        sources,
        processingTime,
        isLLMGenerated
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Search error:', error);
      
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'assistant',
        content: 'I encountered an error while searching the document. Please try your question again.',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsSearching(false);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!isDocumentLoaded) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <MessageSquare className="w-12 h-12 text-gray-400 mx-auto" />
          <div>
            <h3 className="text-lg font-medium text-gray-900">Loading Document</h3>
            <p className="text-gray-500">Please wait while the document is being processed...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-4 py-3 ${
                message.type === 'user'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              {/* LLM Generation Indicator */}
              {message.type === 'assistant' && message.isLLMGenerated && (
                <div className="flex items-center space-x-1 mb-2 text-xs text-blue-600">
                  <Brain className="w-3 h-3" />
                  <span>AI-Enhanced Response</span>
                </div>
              )}

              {/* Message Content */}
              <div className="whitespace-pre-wrap">{message.content}</div>
              
              {/* Sources */}
              {message.sources && message.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <div className="text-xs text-gray-600 mb-2 flex items-center">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Source{message.sources.length > 1 ? 's' : ''} (Page {message.sources[0].chunk.pageNumber})
                  </div>
                  {message.sources.map((source, index) => (
                    <div key={index} className="text-xs bg-white/50 rounded p-2 mb-1 last:mb-0">
                      <div className="text-gray-700">
                        Similarity: {Math.round(source.similarity * 100)}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Timestamp and Processing Time */}
              <div className={`text-xs mt-2 opacity-70 ${
                message.type === 'user' ? 'text-red-100' : 'text-gray-500'
              }`}>
                <Clock className="w-3 h-3 inline mr-1" />
                {formatTime(message.timestamp)}
                {message.processingTime && (
                  <span className="ml-2">• {message.processingTime}ms</span>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {/* Searching/Generating Indicator */}
        {(isSearching || isLLMGenerating) && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg px-4 py-3 flex items-center space-x-2">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <span className="text-sm text-gray-600 ml-2">
                {isLLMGenerating ? 'AI is thinking...' : 'Searching document...'}
              </span>
              {isLLMGenerating && <Brain className="w-4 h-4 text-blue-600" />}
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-red-200 p-4">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={llmGenerateResponse ? "Ask anything about the document..." : "Ask a question about the document..."}
            className="flex-1 px-4 py-2 border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            disabled={isSearching || isProcessing || isLLMGenerating}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isSearching || isProcessing || isLLMGenerating}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-1"
          >
            {llmGenerateResponse && <Zap className="w-4 h-4" />}
            <Send className="w-5 h-5" />
          </button>
        </form>
        
        {/* Disclaimer */}
        <div className="mt-2 flex items-start space-x-2 text-xs text-gray-500">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <p>
            {llmGenerateResponse 
              ? 'AI responses are based on document content and may include interpretation. Always verify important information.'
              : 'I only provide information that\'s explicitly in the document. I cannot infer, interpret, or generate information beyond what\'s written in the PDF.'
            }
          </p>
        </div>
      </div>
    </div>
  );
}