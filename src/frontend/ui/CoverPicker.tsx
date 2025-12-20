import React, { useRef } from 'react';

interface CoverPickerProps {
  projectId: string;
  onSetCover: (projectId: string, coverUrl: string) => void;
  label?: string;
  buttonClassName?: string;
}

export default function CoverPicker({
  projectId,
  onSetCover,
  label = 'Change cover',
  buttonClassName = 'text-xs text-gray-400 hover:text-gray-200',
}: CoverPickerProps) {
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
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                onSetCover(projectId, reader.result);
              }
            };
            reader.readAsDataURL(file);
          }
          e.currentTarget.value = '';
        }}
      />

      <button
        onClick={() => inputRef.current?.click()}
        className={buttonClassName}
        type="button"
      >
        {label}
      </button>
    </div>
  );
}
