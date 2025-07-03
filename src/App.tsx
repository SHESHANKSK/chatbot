import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, FileText, Brain, Database, X, Loader } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import LLMStatus from './components/LLMStatus';
import { VectorStore } from './utils/vectorStore';
import { fetchPdfFile, processPdfDocument } from './utils/pdfUtils';
import { chunkText } from './utils/textProcessing';
import { useWebLLM } from './hooks/useWebLLM';
import type { DocumentChunk } from './types';

function App() {
  const [documentChunks, setDocumentChunks] = useState<DocumentChunk[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [documentTitle, setDocumentTitle] = useState<string>('');
  const [showChat, setShowChat] = useState(false);
  const [loadError, setLoadError] = useState<string>('');
  const vectorStoreRef = useRef<VectorStore | null>(null);

  // WebLLM integration
  const {
    loadingState: llmLoadingState,
    generateResponse,
    isGenerating,
    initializeLLM,
    resetLLM
  } = useWebLLM();

  const handleDocumentProcessed = (chunks: DocumentChunk[], title: string) => {
    setDocumentChunks(chunks);
    setDocumentTitle(title);
    
    // Initialize vector store with processed chunks
    vectorStoreRef.current = new VectorStore(chunks);
    console.log(`Document processed: ${chunks.length} chunks created`);
  };

  const handleProcessingStateChange = (processing: boolean) => {
    setIsProcessing(processing);
  };

  // Auto-load PDF from assets on component mount
  useEffect(() => {
    const loadPdfFromAssets = async () => {
      try {
        setLoadError('');
        setProcessingStage('Loading document...');
        
        // Fetch PDF from assets folder
        const file = await fetchPdfFile('/assets/document.pdf', 'document.pdf');
        
        // Process the PDF
        const extractedData = await processPdfDocument(
          file,
          handleProcessingStateChange,
          setProcessingStage
        );
        
        // Chunk the text
        setProcessingStage('Segmenting text into chunks...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const chunks = chunkText(extractedData.text, extractedData.pageBreaks);
        
        // Finalize
        handleDocumentProcessed(chunks, file.name);
        setProcessingStage('');
        
      } catch (error) {
        console.error('Failed to load PDF from assets:', error);
        setLoadError(error instanceof Error ? error.message : 'Failed to load document');
        setProcessingStage('');
        setIsProcessing(false);
      }
    };

    loadPdfFromAssets();
  }, []);

  const stats = {
    chunks: documentChunks.length,
    avgChunkSize: documentChunks.length > 0 
      ? Math.round(documentChunks.reduce((sum, chunk) => sum + chunk.text.length, 0) / documentChunks.length)
      : 0,
    totalWords: documentChunks.reduce((sum, chunk) => sum + chunk.text.split(/\s+/).length, 0)
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-50">
      {/* Floating Chat Button */}
      {!showChat && (
        <button
          onClick={() => setShowChat(true)}
          className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center z-50"
        >
          <MessageCircle className="w-8 h-8" />
        </button>
      )}

      {/* Main Chat Interface */}
      {showChat && (
        <div className="fixed inset-0 bg-gradient-to-br from-red-50 to-rose-50 z-40">
          {/* Header */}
          <header className="bg-white/80 backdrop-blur-sm border-b border-red-200 sticky top-0 z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-red-600 to-rose-600 rounded-lg flex items-center justify-center">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900">Local RAG Chatbot</h1>
                    <p className="text-sm text-gray-500">
                      {llmLoadingState.isReady ? 'AI-Enhanced' : 'Fully client-side'} PDF analysis
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  {documentChunks.length > 0 && (
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Database className="w-4 h-4" />
                        <span>{stats.chunks} chunks</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <FileText className="w-4 h-4" />
                        <span>{stats.totalWords.toLocaleString()} words</span>
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => setShowChat(false)}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </header>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Panel - Document Status and LLM */}
              <div className="lg:col-span-1 space-y-6">
                {/* Document Status Panel */}
                <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
                  <div className="flex items-center space-x-2 mb-4">
                    <FileText className="w-5 h-5 text-red-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Document Status</h2>
                  </div>
                  
                  {/* Processing Status */}
                  {processingStage && (
                    <div className="flex items-center space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
                      <Loader className="w-5 h-5 text-red-600 animate-spin" />
                      <span className="text-sm font-medium text-red-800">{processingStage}</span>
                    </div>
                  )}

                  {/* Error Display */}
                  {loadError && (
                    <div className="p-3 bg-red-100 border border-red-300 rounded-lg mb-4">
                      <span className="text-sm text-red-800">{loadError}</span>
                    </div>
                  )}

                  {/* Document Info */}
                  {documentTitle && !processingStage && !loadError && (
                    <div className="p-4 bg-rose-50 rounded-lg border border-rose-200">
                      <div className="flex items-center space-x-2 mb-2">
                        <FileText className="w-4 h-4 text-rose-600" />
                        <span className="font-medium text-rose-800">Document Loaded</span>
                      </div>
                      <p className="text-sm text-rose-700 font-medium truncate">{documentTitle}</p>
                      <div className="mt-2 text-xs text-rose-600 space-y-1">
                        <div>Chunks: {stats.chunks}</div>
                        <div>Average chunk size: {stats.avgChunkSize} characters</div>
                        <div>Total words: {stats.totalWords.toLocaleString()}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* LLM Status Panel */}
                <LLMStatus
                  loadingState={llmLoadingState}
                  onInitialize={initializeLLM}
                  isGenerating={isGenerating}
                />

                {/* How It Works */}
                <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h3>
                  <div className="space-y-3 text-sm text-gray-600">
                    <div className="flex items-start space-x-2">
                      <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-semibold text-red-600">1</span>
                      </div>
                      <div>
                        <strong>Auto-Load PDF:</strong> Automatically loads document from assets folder
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-semibold text-red-600">2</span>
                      </div>
                      <div>
                        <strong>PDF Processing:</strong> Extracts text using pdf.js client-side
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-semibold text-red-600">3</span>
                      </div>
                      <div>
                        <strong>Text Chunking:</strong> Intelligently segments content into retrievable pieces
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-semibold text-red-600">4</span>
                      </div>
                      <div>
                        <strong>TF-IDF Embeddings:</strong> Creates local vector representations
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-semibold text-red-600">5</span>
                      </div>
                      <div>
                        <strong>Similarity Search:</strong> Finds relevant content using cosine similarity
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-xs font-semibold text-red-600">6</span>
                      </div>
                      <div>
                        <strong>{llmLoadingState.isReady ? 'AI-Enhanced' : 'Grounded'} Answers:</strong> {llmLoadingState.isReady ? 'Uses local LLM with retrieved context' : 'Returns only document content, no hallucinations'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chat Interface */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-sm border border-red-200 h-[600px] flex flex-col">
                  <div className="flex items-center space-x-2 p-6 border-b border-red-200">
                    <MessageCircle className="w-5 h-5 text-red-600" />
                    <h2 className="text-lg font-semibold text-gray-900">Chat with Document</h2>
                    {(isProcessing || isGenerating) && (
                      <div className="ml-auto flex items-center space-x-2 text-amber-600">
                        <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse"></div>
                        <span className="text-sm">
                          {isGenerating ? 'Generating...' : 'Processing...'}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 overflow-hidden">
                    <ChatInterface 
                      vectorStore={vectorStoreRef.current}
                      isDocumentLoaded={documentChunks.length > 0}
                      isProcessing={isProcessing}
                      llmGenerateResponse={llmLoadingState.isReady ? generateResponse : undefined}
                      isLLMGenerating={isGenerating}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;