import React, { useRef, useState, useEffect, useCallback } from 'react';

interface CameraComponentProps {
  onFrameCaptured: (imageDataUrl: string) => void; // Callback to pass captured frame data
  captureTrigger?: object; // An object that changes reference to trigger capture
  width?: number;
  height?: number;
}

const CameraComponent: React.FC<CameraComponentProps> = ({
  onFrameCaptured,
  captureTrigger,
  width = 640, // Default width
  height = 480, // Default height
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Function to start the camera stream
  const startCamera = useCallback(async () => {
    setError(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width, height },
        audio: false, // No audio needed for image capture
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Wait for metadata to load to get correct dimensions
        videoRef.current.onloadedmetadata = () => {
           if (videoRef.current) {
             videoRef.current.play().catch(err => {
               console.error("Error playing video:", err);
               setError('视频播放失败，请检查摄像头权限或设备。');
             });
           }
        };
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('摄像头访问权限被拒绝。请在浏览器设置中允许访问。');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
           setError('未找到可用的摄像头设备。请尝试刷新页面。');
        } else if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
          setError('无法强制使用后置摄像头，请检查摄像头权限或尝试不强制。可以尝试去掉exact。');
        } else {
           setError('无法访问摄像头，请检查设备连接或权限。');
        }
      } else {
          setError('访问摄像头时发生未知错误。');
      }
      setStream(null); // Ensure stream is null on error
    }
  }, [width, height]);

  // Function to capture a single frame
  const captureFrame = useCallback(() => {
    if (videoRef.current && canvasRef.current && stream) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        // Set canvas dimensions based on video element (respecting aspect ratio)
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        canvas.width = videoWidth;
        canvas.height = videoHeight;

        // Draw the current video frame onto the canvas
        context.drawImage(video, 0, 0, videoWidth, videoHeight);

        // Get the image data as a base64 string (JPEG format)
        const imageDataUrl = canvas.toDataURL('image/jpeg');
        onFrameCaptured(imageDataUrl);
      } else {
        console.error("Failed to get 2D context from canvas");
        setError("无法捕获帧：Canvas Context 获取失败。");
      }
    } else {
       console.warn("Internal: Capture called but video stream or refs are not ready.");
    }
  }, [stream, onFrameCaptured]);

  // Start camera on component mount
  useEffect(() => {
    startCamera();

    // Cleanup function to stop the stream when the component unmounts
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        console.log("Camera stream stopped.");
      }
    };
  }, [startCamera]); // Rerun if startCamera identity changes (due to width/height change)

  // Effect to trigger capture when captureTrigger changes
  useEffect(() => {
    // Only capture if the trigger is not the initial null value AND the stream is ready
    if (captureTrigger !== null && stream) { 
      console.log("Capture triggered by prop change and stream ready.");
      captureFrame();
    } else if (captureTrigger !== null && !stream) {
      console.warn("Capture triggered by prop change, but stream is not ready yet.");
      // Optionally set an error or inform the user
      // setError("请等待摄像头准备就绪后再尝试捕获。");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captureTrigger]); // Keep dependency array as is

  return (
    <div className="camera-container" style={{ position: 'relative' }}>
      {error && (
        <div style={{ color: 'red', marginBottom: '10px', padding: '10px', border: '1px solid red', background: '#ffeeee' }}>
          错误: {error}
          {!error.includes("权限") && !error.includes("找到") && (
             <button onClick={startCamera} style={{ marginLeft: '10px' }}>重试</button>
          )}
        </div>
      )}
      <video
        ref={videoRef}
        autoPlay
        playsInline // Important for mobile browsers
        muted // Muted because we don't request audio
        style={{ display: stream ? 'block' : 'none', width: '100%', height: 'auto' }}
      />
      {/* Canvas for capturing frames, kept hidden */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
       {/* Optional: Show a message or placeholder when the stream is not active */}
       {!stream && !error && (
          <div style={{
            position: 'absolute', // Position relative to parent
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            border: '1px dashed grey', 
            background: '#f0f0f0' 
          }}> {/* Updated: Use absolute positioning to fill container */} 
            正在启动摄像头...
          </div>
       )}
    </div>
  );
};

export default CameraComponent; 