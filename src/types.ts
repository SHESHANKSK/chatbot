/**
 * Core data types for the local RAG system
 */

export interface DocumentChunk {
  id: string;
  text: string;
  pageNumber: number;
  chunkIndex: number;
  startOffset: number;
  endOffset: number;
}

export interface TFIDFVector {
  [term: string]: number;
}

export interface ProcessedChunk extends DocumentChunk {
  tfidfVector: TFIDFVector;
  termCount: number;
}

export interface SearchResult {
  chunk: ProcessedChunk;
  similarity: number;
  relevantSentences: string[];
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: SearchResult[];
  processingTime?: number;
  isLLMGenerated?: boolean;
}

export interface DocumentMetadata {
  title: string;
  pageCount: number;
  wordCount: number;
  chunkCount: number;
  processedAt: Date;
}

export interface LLMConfig {
  enabled: boolean;
  model: string;
  temperature: number;
  maxTokens: number;
  useRAGContext: boolean;
}