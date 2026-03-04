// hooks/useFloorControl.js
import { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';

export default function useFloorControl(activeChannelId) {
  const [status, setStatus] = useState('IDLE'); // IDLE, REQUESTING, TALKING, LOCKED
  const clientRef = useRef(null);
  
  // Tạo một ID định danh tạm thời cho thiết bị này để không tự khóa chính mình
  const myClientId = useRef(`device_${Math.random().toString(36).substring(2, 9)}`).current;

  useEffect(() => {
    // 1. Khởi tạo kết nối WebSocket tới server DigitalOcean
    const client = mqtt.connect('wss://159.203.3.86:9001');
    clientRef.current = client;

    const topic = `skytrac/talkgroup/${activeChannelId}`;

    client.on('connect', () => {
      console.log(`Connected to MQTT. Subscribing to ${topic}`);
      client.subscribe(topic);
      // Khi vừa đổi kênh, reset trạng thái về IDLE
      setStatus('IDLE'); 
    });

    // 2. Lắng nghe tín hiệu giành mic từ các thiết bị khác
    client.on('message', (receivedTopic, message) => {
      if (receivedTopic !== topic) return;

      try {
        const payload = JSON.parse(message.toString());
        
        // Bỏ qua tin nhắn do chính mình gửi
        if (payload.clientId === myClientId) return;

        if (payload.action === 'mic_taken') {
          // Có người khác lấy mic -> Khóa nút
          setStatus(prev => prev === 'TALKING' ? 'TALKING' : 'LOCKED');
        } else if (payload.action === 'mic_freed') {
          // Người kia nhả mic -> Mở khóa
          setStatus('IDLE');
        }
      } catch (err) {
        console.error("Lỗi parse MQTT message", err);
      }
    });

    // 3. Cleanup: Hủy đăng ký và đóng kết nối khi đổi kênh hoặc tắt app
    return () => {
      client.unsubscribe(topic);
      client.end();
    };
  }, [activeChannelId]); // Hook chạy lại mỗi khi activeChannelId thay đổi

  // 4. Các hàm thao tác với Mic
  const requestMic = () => {
    if (status === 'LOCKED') return;
    
    setStatus('REQUESTING');
    
    // Gửi tín hiệu thông báo cho toàn group là mình lấy mic
    const payload = JSON.stringify({ clientId: myClientId, action: 'mic_taken' });
    clientRef.current.publish(`skytrac/talkgroup/${activeChannelId}`, payload);
    
    // Giả lập server phản hồi cấp quyền thành công sau 200ms
    setTimeout(() => {
      setStatus('TALKING');
    }, 200);
  };

  const releaseMic = () => {
    if (status !== 'TALKING') return;
    
    setStatus('IDLE');
    
    // Báo cho group biết đã nói xong
    const payload = JSON.stringify({ clientId: myClientId, action: 'mic_freed' });
    clientRef.current.publish(`skytrac/talkgroup/${activeChannelId}`, payload);
  };

  return { status, requestMic, releaseMic };
}