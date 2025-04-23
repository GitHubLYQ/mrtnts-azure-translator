/**
 * 使用 Web Audio API 播放音频数据。
 * 
 * @param audioData 包含音频数据的 ArrayBuffer (例如来自 Azure TTS)。
 * @returns Promise resolving when playback finishes or rejects on error.
 */
export const playAudio = (audioData: ArrayBuffer): Promise<void> => {
  return new Promise((resolve, reject) => {
    // 检查 Web Audio API 是否可用
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) {
      console.error("Web Audio API is not supported in this browser.");
      return reject(new Error("浏览器不支持 Web Audio API"));
    }

    const audioContext = new AudioContext();
    let source: AudioBufferSourceNode | null = null;

    // 解码音频数据
    audioContext.decodeAudioData(audioData, 
      (buffer) => {
        // 创建一个音频源节点
        source = audioContext.createBufferSource();
        source.buffer = buffer;

        // 连接到音频输出 (扬声器)
        source.connect(audioContext.destination);

        // 监听播放结束事件
        source.onended = () => {
          console.log("Audio playback finished.");
          audioContext.close().catch(e => console.warn("Error closing AudioContext:", e)); // 关闭 context 释放资源
          resolve();
        };

        // 开始播放
        console.log("Starting audio playback...");
        source.start(0);
      },
      (error) => {
        // 解码失败处理
        console.error("Error decoding audio data:", error);
        audioContext.close().catch(e => console.warn("Error closing AudioContext after decode error:", e));
        reject(new Error("解码音频数据失败: " + error.message));
      }
    ).catch(decodeError => {
      // 处理 decodeAudioData 本身可能抛出的同步错误 (虽然不常见)
       console.error("Unexpected error during decodeAudioData call:", decodeError);
       audioContext.close().catch(e => console.warn("Error closing AudioContext after unexpected decode error:", e));
       reject(new Error("解码音频时发生意外错误"));
    });

    // 注意: 这里没有提供停止播放的功能，如果需要可以扩展，
    // 例如返回一个包含 stop 方法的对象。
  });
}; 