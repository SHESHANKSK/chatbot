import type { DocumentChunk } from '../types';

/**
 * Text processing utilities for chunking and preparing content for embedding
 * All operations are performed client-side for privacy and performance
 */

/**
 * Configuration for text chunking
 */
const CHUNK_CONFIG = {
  targetSize: 800,        // Target characters per chunk
  maxSize: 1200,          // Maximum characters per chunk
  minSize: 200,           // Minimum characters per chunk
  overlapSize: 100,       // Character overlap between chunks
  sentenceEndPattern: /[.!?]+\s+/g,
  paragraphPattern: /\n\s*\n/g
};

/**
 * Intelligently chunk text into semantic segments
 * Prioritizes sentence and paragraph boundaries to maintain context
 * 
 * @param text - The full document text
 * @param pageBreaks - Array of character positions where pages break
 * @returns Array of document chunks with metadata
 */
export function chunkText(text: string, pageBreaks: number[] = []): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let chunkIndex = 0;
  
  // Split text into paragraphs first to respect natural boundaries
  const paragraphs = text.split(CHUNK_CONFIG.paragraphPattern);
  let currentPosition = 0;
  
  let currentChunk = '';
  let chunkStartPosition = 0;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i].trim();
    
    if (!paragraph) {
      currentPosition += paragraph.length + 2; // Account for paragraph breaks
      continue;
    }
    
    // If adding this paragraph would exceed max size, finalize current chunk
    if (currentChunk && (currentChunk.length + paragraph.length) > CHUNK_CONFIG.maxSize) {
      if (currentChunk.length >= CHUNK_CONFIG.minSize) {
        chunks.push(createChunk(
          currentChunk.trim(),
          chunkIndex++,
          chunkStartPosition,
          currentPosition - 1,
          pageBreaks
        ));
        
        // Start new chunk with overlap
        const overlap = getOverlapText(currentChunk, CHUNK_CONFIG.overlapSize);
        currentChunk = overlap;
        chunkStartPosition = currentPosition - overlap.length;
      } else {
        // Current chunk too small, just continue adding
        currentChunk += '\n\n' + paragraph;
      }
    } else {
      // Add paragraph to current chunk
      if (currentChunk) {
        currentChunk += '\n\n' + paragraph;
      } else {
        currentChunk = paragraph;
        chunkStartPosition = currentPosition;
      }
    }
    
    currentPosition += paragraph.length + 2; // Account for paragraph breaks
    
    // If current chunk is at target size, try to break at sentence boundary
    if (currentChunk.length >= CHUNK_CONFIG.targetSize) {
      const sentenceBreak = findGoodBreakPoint(currentChunk);
      
      if (sentenceBreak > CHUNK_CONFIG.minSize) {
        const chunkText = currentChunk.substring(0, sentenceBreak).trim();
        chunks.push(createChunk(
          chunkText,
          chunkIndex++,
          chunkStartPosition,
          chunkStartPosition + sentenceBreak,
          pageBreaks
        ));
        
        // Continue with remainder
        const remainder = currentChunk.substring(sentenceBreak - CHUNK_CONFIG.overlapSize).trim();
        currentChunk = remainder;
        chunkStartPosition = chunkStartPosition + sentenceBreak - CHUNK_CONFIG.overlapSize;
      }
    }
  }
  
  // Add final chunk if it has content
  if (currentChunk.trim() && currentChunk.length >= CHUNK_CONFIG.minSize) {
    chunks.push(createChunk(
      currentChunk.trim(),
      chunkIndex++,
      chunkStartPosition,
      currentPosition - 1,
      pageBreaks
    ));
  }
  
  return chunks;
}

/**
 * Create a document chunk with proper metadata
 */
function createChunk(
  text: string,
  chunkIndex: number,
  startOffset: number,
  endOffset: number,
  pageBreaks: number[]
): DocumentChunk {
  return {
    id: `chunk-${chunkIndex}`,
    text,
    pageNumber: getPageNumber(startOffset, pageBreaks),
    chunkIndex,
    startOffset,
    endOffset
  };
}

/**
 * Find the best break point in text (preferring sentence boundaries)
 */
function findGoodBreakPoint(text: string): number {
  const sentences = text.split(CHUNK_CONFIG.sentenceEndPattern);
  let position = 0;
  let bestBreak = text.length;
  
  for (let i = 0; i < sentences.length - 1; i++) {
    position += sentences[i].length + 1; // +1 for the sentence ending
    
    if (position >= CHUNK_CONFIG.minSize && position <= CHUNK_CONFIG.targetSize) {
      bestBreak = position;
    } else if (position > CHUNK_CONFIG.targetSize) {
      break;
    }
  }
  
  return bestBreak;
}

/**
 * Get overlap text from the end of a chunk
 */
function getOverlapText(text: string, overlapSize: number): string {
  if (text.length <= overlapSize) return text;
  
  const overlap = text.substring(text.length - overlapSize);
  
  // Try to start overlap at a word boundary
  const spaceIndex = overlap.indexOf(' ');
  if (spaceIndex > 0) {
    return overlap.substring(spaceIndex + 1);
  }
  
  return overlap;
}

/**
 * Determine which page a character offset belongs to
 */
function getPageNumber(offset: number, pageBreaks: number[]): number {
  for (let i = 0; i < pageBreaks.length; i++) {
    if (offset < pageBreaks[i]) {
      return i + 1;
    }
  }
  return pageBreaks.length + 1;
}

/**
 * Clean and normalize text for processing
 * Removes excessive whitespace and normalizes formatting
 */
export function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')           // Normalize line endings
    .replace(/\r/g, '\n')             // Handle old Mac line endings
    .replace(/\t/g, ' ')              // Replace tabs with spaces
    .replace(/[ ]{2,}/g, ' ')         // Collapse multiple spaces
    .replace(/\n{3,}/g, '\n\n')       // Limit consecutive newlines
    .trim();
}

/**
 * Extract key sentences from a chunk that are most likely to contain answers
 * Used for highlighting relevant parts in search results
 */
export function extractKeySentences(text: string, queryTerms: string[]): string[] {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
  const scoredSentences: Array<{ sentence: string; score: number }> = [];
  
  const queryTermsLower = queryTerms.map(term => term.toLowerCase());
  
  for (const sentence of sentences) {
    const sentenceLower = sentence.toLowerCase();
    let score = 0;
    
    // Score based on query term matches
    for (const term of queryTermsLower) {
      const occurrences = (sentenceLower.match(new RegExp(term, 'g')) || []).length;
      score += occurrences * term.length; // Longer terms get higher weight
    }
    
    // Bonus for sentences with multiple query terms
    const uniqueTermsFound = queryTermsLower.filter(term => sentenceLower.includes(term)).length;
    if (uniqueTermsFound > 1) {
      score += uniqueTermsFound * 50;
    }
    
    if (score > 0) {
      scoredSentences.push({ sentence, score });
    }
  }
  
  // Return top sentences, sorted by score
  return scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.sentence);
}

/**
 * Simple text preprocessing for better matching
 * Removes punctuation and normalizes for term extraction
 */
export function preprocessText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')         // Remove punctuation
    .replace(/\s+/g, ' ')             // Normalize whitespace
    .trim();
}

/**
 * Extract meaningful terms from text (removes common stop words)
 */
export function extractTerms(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does',
    'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this',
    'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him',
    'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their'
  ]);
  
  return preprocessText(text)
    .split(/\s+/)
    .filter(term => term.length > 2 && !stopWords.has(term))
    .filter((term, index, array) => array.indexOf(term) === index); // Remove duplicates
}