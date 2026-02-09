import { useState, useEffect, useRef, type KeyboardEvent, type DragEvent, type ChangeEvent } from 'react';
import type { ImageData } from '../types';

// Web Speech API types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface ChatInputProps {
  onSubmit: (prompt: string, images?: ImageData[]) => void;
  isLoading: boolean;
  value?: string;
  onChange?: (value: string) => void;
}

const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export function ChatInput({ onSubmit, isLoading, value, onChange }: ChatInputProps) {
  const [internalPrompt, setInternalPrompt] = useState('');
  const [images, setImages] = useState<ImageData[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Check for speech recognition support
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setSpeechSupported(!!SpeechRecognition);
  }, []);

  // Use controlled value if provided
  const prompt = value !== undefined ? value : internalPrompt;
  const setPrompt = onChange || setInternalPrompt;

  // Sync with external value changes
  useEffect(() => {
    if (value !== undefined) {
      setInternalPrompt(value);
    }
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    // Escape to clear (handled at App level for global, but also here for textarea)
    if (e.key === 'Escape') {
      setPrompt('');
      setImages([]);
    }
  };

  const handleSubmit = () => {
    if ((prompt.trim() || images.length > 0) && !isLoading) {
      onSubmit(prompt.trim(), images.length > 0 ? images : undefined);
      setPrompt('');
      setInternalPrompt('');
      setImages([]);
    }
  };

  const processFile = async (file: File): Promise<ImageData | null> => {
    if (!file.type.startsWith('image/')) {
      return null;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      alert(`Image ${file.name} is too large. Max size is 10MB.`);
      return null;
    }

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({
          base64,
          mimeType: file.type,
          name: file.name,
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  };

  const addImages = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remainingSlots = MAX_IMAGES - images.length;

    if (remainingSlots <= 0) {
      alert(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }

    const filesToProcess = fileArray.slice(0, remainingSlots);
    const newImages: ImageData[] = [];

    for (const file of filesToProcess) {
      const imageData = await processFile(file);
      if (imageData) {
        newImages.push(imageData);
      }
    }

    setImages((prev) => [...prev, ...newImages]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (e.dataTransfer.files.length > 0) {
      await addImages(e.dataTransfer.files);
    }
  };

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await addImages(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          imageFiles.push(file);
        }
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      await addImages(imageFiles);
    }
  };

  const toggleVoiceInput = () => {
    if (!speechSupported) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        setPrompt((prev) => prev + finalTranscript);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  return (
    <div className="w-full p-4 bg-gray-800 border-t border-gray-700">
      <div className="max-w-6xl mx-auto">
        {/* Image previews */}
        {images.length > 0 && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {images.map((img, index) => (
              <div key={index} className="relative group">
                <img
                  src={`data:${img.mimeType};base64,${img.base64}`}
                  alt={img.name}
                  className="h-16 w-16 object-cover rounded border border-gray-600"
                />
                <button
                  onClick={() => removeImage(index)}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
                <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] truncate px-1">
                  {img.name}
                </span>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="h-16 w-16 border-2 border-dashed border-gray-600 rounded flex items-center justify-center text-gray-400 hover:border-gray-500 hover:text-gray-300 transition-colors"
              >
                +
              </button>
            )}
          </div>
        )}

        <div
          className={`flex gap-3 ${isDragOver ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-800 rounded-lg' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex-1 relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={images.length > 0
                ? "Add a message about the image(s)... (Press Enter to send)"
                : "Enter your prompt... (Press Enter to send, Shift+Enter for new line)"
              }
              className="w-full p-3 pr-10 bg-gray-700 text-gray-100 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none resize-none"
              rows={3}
              disabled={isLoading}
            />
            {/* Voice input button */}
            {speechSupported && (
              <button
                onClick={toggleVoiceInput}
                disabled={isLoading}
                className={`absolute right-10 bottom-2 p-1.5 transition-colors ${
                  isListening
                    ? 'text-red-500 animate-pulse'
                    : 'text-gray-400 hover:text-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={isListening ? 'Stop listening' : 'Start voice input'}
              >
                🎤
              </button>
            )}
            {/* Image upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || images.length >= MAX_IMAGES}
              className="absolute right-2 bottom-2 p-1.5 text-gray-400 hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Attach images (or paste/drag)"
            >
              📷
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={isLoading || (!prompt.trim() && images.length === 0)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </div>

        {isDragOver && (
          <div className="mt-2 text-center text-blue-400 text-sm">
            Drop images here
          </div>
        )}
      </div>
    </div>
  );
}
