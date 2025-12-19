import React, { useRef } from 'react';

interface CoverPickerProps {
  projectRoot: string;
  onSetCover: (rootPath: string, coverUrl: string) => void;
}

export default function CoverPicker({ projectRoot, onSetCover }: CoverPickerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex items-center gap-2">
      <input
        ref={el => (inputRef.current = el)}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => {
          const file = e.currentTarget.files?.[0];
          if (file) {
            const url = URL.createObjectURL(file);
            onSetCover(projectRoot, url);
          }
          e.currentTarget.value = '';
        }}
      />

      <button
        onClick={() => inputRef.current?.click()}
        className="text-xs text-gray-400 hover:text-gray-200"
        type="button"
      >
        Change cover
      </button>
    </div>
  );
}
