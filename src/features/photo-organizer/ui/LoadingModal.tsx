import React, { useEffect, useState } from 'react';
import { Loader } from 'lucide-react';

interface LoadingModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  progress?: number; // 0-100
  showProgressBar?: boolean;
}

export default function LoadingModal({
  isOpen,
  title = 'Loading Project',
  message = 'Please wait while we load your project...',
  progress = 0,
  showProgressBar = true,
}: LoadingModalProps) {
  const [displayProgress, setDisplayProgress] = useState(0);

  // Smooth progress animation
  useEffect(() => {
    if (progress !== displayProgress) {
      const timer = setTimeout(() => {
        setDisplayProgress(progress);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [progress, displayProgress]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg shadow-2xl p-8 max-w-md w-full mx-4 border border-gray-800">
        {/* Header with icon */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-500 rounded-full blur-lg opacity-20"></div>
            <Loader className="w-12 h-12 text-blue-400 animate-spin relative" />
          </div>

          <div className="text-center">
            <h2 className="text-xl font-bold text-white mb-2">{title}</h2>
            <p className="text-gray-400 text-sm">{message}</p>
          </div>
        </div>

        {/* Progress bar */}
        {showProgressBar && (
          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-medium text-gray-400">Progress</span>
              <span className="text-xs font-bold text-blue-400">
                {Math.round(displayProgress)}%
              </span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-400 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${displayProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Loading status text */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 animate-pulse">
            {displayProgress === 100 ? 'Almost done...' : 'Loading...'}
          </p>
        </div>
      </div>
    </div>
  );
}
