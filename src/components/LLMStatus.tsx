import React from 'react';
import { Brain, Loader, AlertCircle, CheckCircle, Download } from 'lucide-react';
import type { LLMLoadingState } from '../hooks/useWebLLM';

interface LLMStatusProps {
  loadingState: LLMLoadingState;
  onInitialize: () => void;
  isGenerating: boolean;
}

export default function LLMStatus({ loadingState, onInitialize, isGenerating }: LLMStatusProps) {
  const { isLoading, progress, stage, error, isReady } = loadingState;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Brain className="w-5 h-5 text-red-600" />
        <h2 className="text-lg font-semibold text-gray-900">Local LLM</h2>
      </div>

      {/* LLM Status */}
      <div className="space-y-4">
        {!isReady && !isLoading && !error && (
          <div className="text-center">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Brain className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">Enhanced AI Mode</h3>
            <p className="text-xs text-gray-500 mb-4">
              Load a local language model for more intelligent responses
            </p>
            <button
              onClick={onInitialize}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
            >
              Initialize LLM
            </button>
            <p className="text-xs text-gray-400 mt-2">
              ~1.5GB download required
            </p>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <Loader className="w-5 h-5 text-red-600 animate-spin" />
              <span className="text-sm font-medium text-red-800">Loading Model...</span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-red-100 rounded-full h-2">
              <div 
                className="bg-red-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            
            <div className="text-xs text-red-600">
              {progress}% - {stage}
            </div>
            
            <div className="text-xs text-gray-500 bg-red-50 p-2 rounded">
              <Download className="w-3 h-3 inline mr-1" />
              Downloading Phi-3-mini model (~1.5GB). This may take several minutes depending on your connection.
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-start space-x-2 p-3 bg-red-100 border border-red-300 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="text-sm text-red-800 font-medium">Failed to load LLM</span>
              <p className="text-xs text-red-600 mt-1">{error}</p>
              <button
                onClick={onInitialize}
                className="text-xs text-red-700 underline mt-2 hover:text-red-800"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {isReady && (
          <div className="space-y-3">
            <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div className="flex-1">
                <span className="text-sm font-medium text-green-800">LLM Ready</span>
                <p className="text-xs text-green-600">Phi-3-mini model loaded successfully</p>
              </div>
            </div>

            {isGenerating && (
              <div className="flex items-center space-x-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <Loader className="w-4 h-4 text-blue-600 animate-spin" />
                <span className="text-sm text-blue-800">Generating response...</span>
              </div>
            )}
          </div>
        )}

        {/* LLM Info */}
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 space-y-1">
          <p className="font-medium text-gray-700">About Local LLM:</p>
          <ul className="space-y-0.5">
            <li>• Runs entirely in your browser</li>
            <li>• No data sent to external servers</li>
            <li>• Uses WebAssembly for performance</li>
            <li>• Combines with document retrieval for accurate answers</li>
          </ul>
        </div>
      </div>
    </div>
  );
}