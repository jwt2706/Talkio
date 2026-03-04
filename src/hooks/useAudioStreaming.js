// hooks/useAudioStreaming.js
import { useRef } from 'react';

// SỬA LỖI: Đổi myClientId thành myAudioId cho khớp với App.jsx
export default function useAudioStreaming(mqttClient, activeChannelId, myAudioId) {
  const mediaRecorderRef = useRef(null);

  // Hàm bắt đầu thu âm
  const startRecording = async () => {
    try {
      // 1. Xin quyền truy cập Microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 2. Ép trình duyệt dùng bộ nén Opus để tiết kiệm băng thông tối đa
      // Đáp ứng tiêu chí Data Efficiency của Hackathon
      const options = { mimeType: 'audio/webm;codecs=opus' };
      const recorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = recorder;

      // 3. Mỗi khi có một "chunk" âm thanh được tạo ra
      recorder.ondataavailable = async (event) => {
        if (event.data.size > 0 && mqttClient) {
          // 1. Chuyển Blob thành ArrayBuffer và ép về Uint8Array
          const arrayBuffer = await event.data.arrayBuffer();
          const audioBytes = new Uint8Array(arrayBuffer);

          // 2. TẠO GÓI TIN TỐI ƯU BĂNG THÔNG: 1 Byte ID + Audio
          const payload = new Uint8Array(1 + audioBytes.length);
          payload[0] = myAudioId; // SỬA LỖI: Dùng đúng biến myAudioId
          payload.set(audioBytes, 1); // Đổ data âm thanh vào từ byte thứ 2
          
          // 3. Publish thẳng lên một topic dành riêng cho âm thanh
          const audioTopic = `skytrac/audio/${activeChannelId}`;
          mqttClient.publish(audioTopic, payload);
          
          console.log(`📤 Đã gửi 1 chunk nhị phân: ${payload.byteLength} bytes lên ${audioTopic}`);
        }
      };

      // 4. Băm nhỏ âm thanh: Cứ 500ms xuất ra 1 chunk để gửi đi (giúp giảm độ trễ)
      recorder.start(500); 
      console.log('🎤 Bắt đầu thu âm...');

    } catch (err) {
      console.error('Lỗi truy cập Microphone:', err);
    }
  };

  // Hàm dừng thu âm
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      
      // Tắt các track của mic để nhả biểu tượng "đang ghi âm" trên trình duyệt
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      console.log('🛑 Đã dừng thu âm.');
    }
  };

  return { startRecording, stopRecording };
}