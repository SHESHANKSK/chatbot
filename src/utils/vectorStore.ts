import type { DocumentChunk, TFIDFVector, ProcessedChunk, SearchResult } from '../types';
import { extractTerms, extractKeySentences } from './textProcessing';

/**
 * Local vector store implementation using TF-IDF for text representation
 * All operations are performed client-side - no external APIs required
 * 
 * TF-IDF (Term Frequency-Inverse Document Frequency) is chosen because:
 * 1. It works entirely offline without pre-trained models
 * 2. It's computationally efficient for small-medium document collections
 * 3. It provides interpretable similarity scores
 * 4. It handles domain-specific terminology well
 * 
 * Limitations compared to neural embeddings:
 * - No semantic understanding (won't match synonyms automatically)
 * - Sensitive to exact word matching
 * - Cannot capture complex relationships between concepts
 * - Performance degrades with very large document collections
 */
export class VectorStore {
  private chunks: ProcessedChunk[] = [];
  private vocabulary: Set<string> = new Set();
  private idfScores: Map<string, number> = new Map();
  private isInitialized = false;

  constructor(documentChunks: DocumentChunk[]) {
    this.initializeStore(documentChunks);
  }

  /**
   * Initialize the vector store with document chunks
   * Computes TF-IDF vectors for all chunks
   */
  private initializeStore(documentChunks: DocumentChunk[]): void {
    console.log(`Initializing vector store with ${documentChunks.length} chunks...`);
    
    // Step 1: Extract all terms and build vocabulary
    const allTerms: string[][] = [];
    
    for (const chunk of documentChunks) {
      const terms = extractTerms(chunk.text);
      allTerms.push(terms);
      terms.forEach(term => this.vocabulary.add(term));
    }
    
    console.log(`Vocabulary size: ${this.vocabulary.size} unique terms`);
    
    // Step 2: Calculate IDF scores for each term
    this.calculateIDF(allTerms);
    
    // Step 3: Create processed chunks with TF-IDF vectors
    this.chunks = documentChunks.map((chunk, index) => {
      const terms = allTerms[index];
      const tfidfVector = this.calculateTFIDF(terms);
      
      return {
        ...chunk,
        tfidfVector,
        termCount: terms.length
      };
    });
    
    this.isInitialized = true;
    console.log(`Vector store initialized. Ready for queries.`);
  }

  /**
   * Calculate Inverse Document Frequency for all terms
   * IDF = log(total_documents / documents_containing_term)
   */
  private calculateIDF(allTerms: string[][]): void {
    const documentCount = allTerms.length;
    const termDocumentCounts = new Map<string, number>();
    
    // Count how many documents contain each term
    for (const terms of allTerms) {
      const uniqueTerms = new Set(terms);
      for (const term of uniqueTerms) {
        const count = termDocumentCounts.get(term) || 0;
        termDocumentCounts.set(term, count + 1);
      }
    }
    
    // Calculate IDF scores
    for (const [term, docCount] of termDocumentCounts) {
      const idf = Math.log(documentCount / docCount);
      this.idfScores.set(term, idf);
    }
  }

  /**
   * Calculate TF-IDF vector for a list of terms
   * TF = term_frequency / total_terms_in_document
   * TF-IDF = TF * IDF
   */
  private calculateTFIDF(terms: string[]): TFIDFVector {
    const termFreq = new Map<string, number>();
    const totalTerms = terms.length;
    
    // Calculate term frequencies
    for (const term of terms) {
      const count = termFreq.get(term) || 0;
      termFreq.set(term, count + 1);
    }
    
    // Calculate TF-IDF scores
    const tfidfVector: TFIDFVector = {};
    for (const [term, freq] of termFreq) {
      const tf = freq / totalTerms;
      const idf = this.idfScores.get(term) || 0;
      tfidfVector[term] = tf * idf;
    }
    
    return tfidfVector;
  }

  /**
   * Calculate cosine similarity between two TF-IDF vectors
   * Returns value between 0 and 1, where 1 is identical
   */
  private cosineSimilarity(vectorA: TFIDFVector, vectorB: TFIDFVector): number {
    const keysA = Object.keys(vectorA);
    const keysB = Object.keys(vectorB);
    const allKeys = new Set([...keysA, ...keysB]);
    
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    
    for (const key of allKeys) {
      const valueA = vectorA[key] || 0;
      const valueB = vectorB[key] || 0;
      
      dotProduct += valueA * valueB;
      magnitudeA += valueA * valueA;
      magnitudeB += valueB * valueB;
    }
    
    const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
    
    // Avoid division by zero
    if (magnitude === 0) return 0;
    
    return dotProduct / magnitude;
  }

  /**
   * Search for relevant chunks based on a query
   * Returns the most similar chunks ranked by cosine similarity
   */
  public async search(query: string, topK: number = 5): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      throw new Error('Vector store not initialized');
    }
    
    console.log(`Searching for: "${query}"`);
    const startTime = Date.now();
    
    // Convert query to TF-IDF vector
    const queryTerms = extractTerms(query);
    const queryVector = this.calculateTFIDF(queryTerms);
    
    console.log(`Query terms: [${queryTerms.join(', ')}]`);
    
    // Calculate similarity with all chunks
    const similarities: Array<{ chunk: ProcessedChunk; similarity: number }> = [];
    
    for (const chunk of this.chunks) {
      const similarity = this.cosineSimilarity(queryVector, chunk.tfidfVector);
      similarities.push({ chunk, similarity });
    }
    
    // Sort by similarity (highest first) and take top K
    similarities.sort((a, b) => b.similarity - a.similarity);
    const topResults = similarities.slice(0, topK);
    
    // Create search results with relevant sentences
    const searchResults: SearchResult[] = topResults.map(({ chunk, similarity }) => {
      const relevantSentences = extractKeySentences(chunk.text, queryTerms);
      
      return {
        chunk,
        similarity,
        relevantSentences
      };
    });
    
    const searchTime = Date.now() - startTime;
    console.log(`Search completed in ${searchTime}ms. Top similarity: ${topResults[0]?.similarity.toFixed(3) || 'N/A'}`);
    
    return searchResults;
  }

  /**
   * Get statistics about the vector store
   */
  public getStats(): {
    chunkCount: number;
    vocabularySize: number;
    averageChunkLength: number;
    isInitialized: boolean;
  } {
    const averageChunkLength = this.chunks.length > 0
      ? Math.round(this.chunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / this.chunks.length)
      : 0;
    
    return {
      chunkCount: this.chunks.length,
      vocabularySize: this.vocabulary.size,
      averageChunkLength,
      isInitialized: this.isInitialized
    };
  }

  /**
   * Find chunks containing specific terms (exact match)
   * Useful for debugging and understanding retrieval
   */
  public findChunksWithTerms(terms: string[]): ProcessedChunk[] {
    const lowerTerms = terms.map(t => t.toLowerCase());
    
    return this.chunks.filter(chunk => {
      const chunkText = chunk.text.toLowerCase();
      return lowerTerms.some(term => chunkText.includes(term));
    });
  }

  /**
   * Get the most important terms in the document collection
   * Based on TF-IDF scores across all chunks
   */
  public getTopTerms(limit: number = 20): Array<{ term: string; score: number }> {
    const termScores = new Map<string, number>();
    
    // Aggregate TF-IDF scores across all chunks
    for (const chunk of this.chunks) {
      for (const [term, score] of Object.entries(chunk.tfidfVector)) {
        const currentScore = termScores.get(term) || 0;
        termScores.set(term, currentScore + score);
      }
    }
    
    // Sort by aggregated score
    const sortedTerms = Array.from(termScores.entries())
      .map(([term, score]) => ({ term, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    return sortedTerms;
  }
}

// Export type for use in components
export type { VectorStore };