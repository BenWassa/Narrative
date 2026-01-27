import React, { useEffect, useRef, useState } from 'react';

interface DebugOverlayProps {
  enabled: boolean;
  photos: number;
  filteredPhotos: number;
  selectedPhotos: number;
  currentView: string;
}

export default function DebugOverlay({
  enabled,
  photos,
  filteredPhotos,
  selectedPhotos,
  currentView,
}: DebugOverlayProps) {
  const lastRenderRef = useRef<number>(performance.now());
  const [renderTime, setRenderTime] = useState(0);

  useEffect(() => {
    const now = performance.now();
    const delta = now - lastRenderRef.current;
    lastRenderRef.current = now;
    if (enabled) {
      setRenderTime(delta);
    }
  }, [enabled, photos, filteredPhotos, selectedPhotos, currentView]);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-4 left-4 bg-black/90 text-white text-xs p-3 rounded-lg font-mono z-50">
      <div className="font-bold mb-2">Debug Info</div>
      <div>Total Photos: {photos}</div>
      <div>Filtered: {filteredPhotos}</div>
      <div>Selected: {selectedPhotos}</div>
      <div>View: {currentView}</div>
      <div>Last Render: {renderTime.toFixed(2)}ms</div>
      <div className="mt-2 text-gray-400">Press Ctrl+Shift+D to toggle</div>
    </div>
  );
}
