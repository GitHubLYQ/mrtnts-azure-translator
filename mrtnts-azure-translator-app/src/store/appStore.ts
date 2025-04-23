import { create } from 'zustand';

// 定义状态的类型接口
interface AppState {
  capturedImageData: string | null; // Base64 data URL of the captured image
  recognizedText: string | null; // Text recognized by OCR
  targetLanguage: 'ko' | 'en'; // Target language for translation
  translatedText: string | null; // Translated text
  isRecognizing: boolean; // Loading state for recognition API call
  isTranslating: boolean; // Loading state for translation API call
  isSynthesizing: boolean; // Loading state for TTS API call
  isPlayingAudio: boolean; // State indicating if audio is currently playing
  error: string | null; // General error message

  // Actions to update the state
  setCapturedImage: (data: string | null) => void;
  setRecognizedText: (text: string | null) => void;
  setTargetLanguage: (lang: 'ko' | 'en') => void;
  setTranslatedText: (text: string | null) => void;
  setIsRecognizing: (loading: boolean) => void;
  setIsTranslating: (loading: boolean) => void;
  setIsSynthesizing: (loading: boolean) => void;
  setIsPlayingAudio: (playing: boolean) => void;
  setError: (error: string | null) => void;
  resetState: () => void; // Action to reset parts of the state
}

// 创建 Zustand store
export const useAppStore = create<AppState>((set) => ({
  // 初始状态
  capturedImageData: null,
  recognizedText: null,
  targetLanguage: 'ko', // Default to Korean
  translatedText: null,
  isRecognizing: false,
  isTranslating: false,
  isSynthesizing: false,
  isPlayingAudio: false,
  error: null,

  // 实现 Actions
  setCapturedImage: (data) => set({ capturedImageData: data }),
  setRecognizedText: (text) => set({ recognizedText: text }),
  setTargetLanguage: (lang) => set({ targetLanguage: lang, translatedText: null }), // Reset translation when language changes
  setTranslatedText: (text) => set({ translatedText: text }),
  setIsRecognizing: (loading) => set({ isRecognizing: loading }),
  setIsTranslating: (loading) => set({ isTranslating: loading }),
  setIsSynthesizing: (loading) => set({ isSynthesizing: loading }),
  setIsPlayingAudio: (playing) => set({ isPlayingAudio: playing }),
  setError: (error) => set({ error: error }),

  // 重置状态 (可以根据需要选择性重置)
  resetState: () => set({
    capturedImageData: null,
    recognizedText: null,
    translatedText: null,
    isRecognizing: false,
    isTranslating: false,
    isSynthesizing: false,
    isPlayingAudio: false,
    error: null,
    // targetLanguage is often kept unless explicitly reset
  }),
})); 