import { useCallback, useRef, useEffect } from 'react';
import './App.css'; // Basic styling
import CameraComponent from './components/CameraComponent';
import InteractiveImageView from './components/InteractiveImageView';
import { useAppStore } from './store/appStore';
// Ensure correct import path for the updated api.ts
import { recognizeImage, translateText, synthesizeSpeech } from './services/api'; 
import { playAudio } from './services/audioPlayer';

function App() {
  // Zustand store state and actions
  const {
    capturedImageData,
    translatedText,
    isRecognizing,
    isSynthesizing,
    isPlayingAudio,
    error,
    setCapturedImage,
    setRecognizedText,
    setTargetLanguage,
    setTranslatedText,
    setIsRecognizing,
    setIsTranslating,
    setIsSynthesizing,
    setIsPlayingAudio,
    setError,
    resetState,
  } = useAppStore();

  // You might still need recognizedText, targetLanguage for the useEffect check, let's get them
  const recognizedText = useAppStore(state => state.recognizedText);
  const targetLanguage = useAppStore(state => state.targetLanguage);
  const isTranslating = useAppStore(state => state.isTranslating);

  // Ref to trigger capture in CameraComponent
  const captureTriggerRef = useRef<object | null>(null);

  // --- Event Handlers & Effects ---

  // handleTranslate: Reads latest state directly using store.getState()
  const handleTranslate = useCallback(async () => { 
    console.log('[handleTranslate entered]');
    // Read the latest state directly from the store using getState()
    const latestState = useAppStore.getState();
    const currentText = latestState.recognizedText; 
    const currentTargetLanguage = latestState.targetLanguage;
    const currentIsTranslating = latestState.isTranslating;

    console.log(`[handleTranslate state check] currentText: ${!!currentText}, currentTargetLanguage: ${currentTargetLanguage}, currentIsTranslating: ${currentIsTranslating}`);

    if (!currentText || currentIsTranslating) { 
      console.log(`[handleTranslate skipped] Condition (!currentText || currentIsTranslating) is true.`);
      return;
    }
    
    console.log(`[handleTranslate proceeding] Attempting translation to ${currentTargetLanguage} for: ${currentText.substring(0, 20)}...`);
    // Use setters from the hook (they are stable)
    setError(null);
    setIsTranslating(true);
    setTranslatedText(null);

    try {
      console.log('[handleTranslate try block entered]');
      // translateText is stable import
      const translation = await translateText(currentText, currentTargetLanguage);
      console.log('[handleTranslate received translation]:', translation);
      setTranslatedText(translation);
    } catch (err: any) {
      console.error("[handleTranslate catch block] Translation failed:", err);
      setError(err.message || '文本翻译失败');
      setTranslatedText(null);
    } finally {
      console.log('[handleTranslate finally block] Setting isTranslating to false.');
      setIsTranslating(false);
    }
  // Dependencies remain stable setters and the imported service function.
  }, [setError, setIsTranslating, setTranslatedText, translateText]); 

  // Effect to automatically trigger translation when recognizedText or targetLanguage changes
  useEffect(() => {
    // Read state for the check using the hook (this is fine as effect re-runs on changes)
    const currentIsTranslating = isTranslating;
    
    console.log(`[useEffect check] recognizedText: ${!!recognizedText}, targetLanguage: ${targetLanguage}, currentIsTranslating: ${currentIsTranslating}`);
    
    if (recognizedText && !currentIsTranslating) { 
       console.log('[useEffect triggering handleTranslate]');
       handleTranslate(); // handleTranslate instance is stable, but reads latest state inside
    } else {
        console.log('[useEffect skipped handleTranslate call]');
    }
  }, [recognizedText, targetLanguage, handleTranslate]); // Add handleTranslate back as dependency now it's stable and reads correctly

  // handleFrameCaptured: Removed handleTranslate from deps as it's handled by useEffect
  const handleFrameCaptured = useCallback(
    async (imageDataUrl: string) => {
      console.log('Frame captured');
      resetState();
      setCapturedImage(imageDataUrl);
      setIsRecognizing(true);
      setRecognizedText(null); 
      setTranslatedText(null); 

      try {
        const base64Data = imageDataUrl.split(',')[1];
        if (!base64Data) throw new Error("Invalid image data URL format");
        
        const result = await recognizeImage(base64Data);
        console.log('Azure CV Recognition result:', result);
        
        const recognizedOcrText = result.ocrText;
        // Set the recognized text. The useEffect above will handle triggering translation.
        setRecognizedText(recognizedOcrText || '未识别到文本。'); 
        
      } catch (err: any) {
        console.error("Recognition failed:", err);
        setError(err.message || '图像识别失败');
        setRecognizedText(null);
      } finally {
        setIsRecognizing(false);
      }
    },
    // Only include dependencies directly used or setters
    [resetState, setCapturedImage, setIsRecognizing, setRecognizedText, setError, setTranslatedText] 
  );

  const triggerCapture = useCallback(() => {
    captureTriggerRef.current = { timestamp: Date.now() }; 
    resetState(); 
  }, [resetState]);

  // handlePlayAudio (unchanged)
  const handlePlayAudio = useCallback(async () => {
    if (!translatedText || isSynthesizing || isPlayingAudio) {
      return;
    }
    setError(null);
    setIsSynthesizing(true);

    try {
      const languageCode = targetLanguage === 'ko' ? 'ko-KR' : 'en-US';
      const audioData = await synthesizeSpeech(translatedText, languageCode);
      setIsSynthesizing(false);
      setIsPlayingAudio(true);
      await playAudio(audioData);
    } catch (err: any) {
      console.error("TTS or playback failed:", err);
      setError(err.message || '语音合成或播放失败');
    } finally {
      setIsSynthesizing(false);
      setIsPlayingAudio(false);
    }
  }, [translatedText, targetLanguage, isSynthesizing, isPlayingAudio, setError, setIsSynthesizing, setIsPlayingAudio, synthesizeSpeech, playAudio]);

  // handleLanguageChange only updates the state now
  const handleLanguageChange = (lang: 'ko' | 'en') => {
     if (lang !== targetLanguage) {
      console.log(`Language changed to: ${lang}`);
      setTargetLanguage(lang);
    }
  };

  return (
    <div className="App">
      <h1>实时图像识别与翻译 (Azure CV & Translator)</h1>

      <div className="main-content">
        {/* Left side: Camera and Controls */}
        <div className="left-panel">
          <CameraComponent
            onFrameCaptured={handleFrameCaptured}
            captureTrigger={captureTriggerRef.current === null ? undefined : captureTriggerRef.current}
          />
          <div className="controls">
            <button onClick={triggerCapture} disabled={isRecognizing}>{(isRecognizing && !capturedImageData) ? '处理中...' : '捕获并识别'}</button>
            <button onClick={resetState} style={{ marginLeft: '10px' }}>重置</button>
          </div>
        </div>

        {/* Right side: Results */}
        <div className="right-panel">
          <div className="image-view-container">
              <p>识别图像预览 (可交互):</p>
             <InteractiveImageView imageDataUrl={capturedImageData} height="250px" />
          </div>

          {/* Only show results area if something is happening or has happened */}
          {(capturedImageData || isRecognizing || recognizedText || translatedText || error) && (
            <div className="results-area">
              {isRecognizing && <p>正在识别 (Azure CV)...</p>}
              {error && <p className="error-message">错误: {error}</p>}
              
              {recognizedText && (
                 <div className="text-section">
                   <h3>识别文本 (Azure CV):</h3>
                   <textarea readOnly value={recognizedText} rows={4}></textarea>
                   <div className="translation-controls">
                     <span>翻译为:</span>
                     <button onClick={() => handleLanguageChange('ko')} disabled={targetLanguage === 'ko' || isTranslating || isRecognizing}>韩语</button>
                     <button onClick={() => handleLanguageChange('en')} disabled={targetLanguage === 'en' || isTranslating || isRecognizing}>英语</button>
                   </div>
                 </div>
              )}

              {isTranslating && <p>正在翻译 (Azure Translator)...</p>}
              
              {translatedText && (
                <div className="text-section">
                  <h3>翻译结果 ({targetLanguage === 'ko' ? '韩语' : '英语'}):</h3>
                  <textarea readOnly value={translatedText} rows={4}></textarea>
                  <button onClick={handlePlayAudio} disabled={isSynthesizing || isPlayingAudio}>
                    {isSynthesizing ? '合成中 (Azure TTS)..' : (isPlayingAudio ? '播放中...' : '朗读')}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
