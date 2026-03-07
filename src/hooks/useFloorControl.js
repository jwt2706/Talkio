// hooks/useFloorControl.js
import { useState, useEffect, useRef } from 'react';
import mqtt from 'mqtt';


export default function useFloorControl(activeChannelId, shouldConnect) {
  const [status, setStatus] = useState('IDLE'); // IDLE, REQUESTING, TALKING, LOCKED
  const clientRef = useRef(null);
  const myClientId = useRef(`device_${Math.random().toString(36).substring(2, 9)}`).current;

  useEffect(() => {
    // 1. Khai báo thông tin xác thực cho MQTT
    const connectionOptions = {
      clientId: myClientId,
      username: 'user1', // Thay bằng 1 trong 4 user bạn đã tạo (vd: user1)
      password: '112233', // Điền mật khẩu mà bạn đã thiết lập
      clean: true,
      connectTimeout: 30000, // Cho phép tối đa 30s để bắt tay với server
      keepalive: 60,         // Gửi gói tin ping kiểm tra mạng mỗi 60s
      reconnectPeriod: 5000, // Tự động thử kết nối lại sau 1s nếu rớt mạng
    };

    // 2. Khởi tạo kết nối WSS tới tên miền talk-io.app
    //const client = mqtt.connect('wss://talk-io.app:9001', connectionOptions);
    const client = mqtt.connect('wss://talk-io.app/mqtt', {
      ...connectionOptions,
      connectTimeout: 20000,
      reconnectPeriod: 2000,
      keepalive: 30,
    });
    clientRef.current = client;
    const topic = `skytrac/talkgroup/${activeChannelId}`;

    client.on('connect', () => {
      console.log(`Connected securely to MQTT. Subscribing to ${topic}`);
      client.subscribe(topic);
      setStatus('IDLE'); 
    });

    // Thêm hàm lắng nghe lỗi để dễ debug trên console của Electron
    client.on('error', (err) => {
      console.error('MQTT Connection Error:', err);
    });

    // 3. Lắng nghe tín hiệu giành mic từ các thiết bị khác
    client.on('message', (receivedTopic, message) => {
      if (receivedTopic !== topic) return;

      try {
        const payload = JSON.parse(message.toString());
        if (payload.clientId === myClientId) return;

        if (payload.action === 'mic_taken') {
          setStatus(prev => prev === 'TALKING' ? 'TALKING' : 'LOCKED');
        } else if (payload.action === 'mic_freed') {
          setStatus('IDLE');
        }
      } catch (err) {
        console.error("Lỗi parse MQTT message", err);
      }
    });

    // 4. Cleanup: Hủy đăng ký và đóng kết nối khi đổi kênh hoặc tắt app
    return () => {
      client.unsubscribe(topic);
      client.end();
    };
  }, [activeChannelId, myClientId]); 

  // 5. Các hàm thao tác với Mic
  const requestMic = () => {
    if (status === 'LOCKED') return;
    setStatus('REQUESTING');
    
    const payload = JSON.stringify({ clientId: myClientId, action: 'mic_taken' });
    clientRef.current.publish(`skytrac/talkgroup/${activeChannelId}`, payload);
    
    setTimeout(() => {
      setStatus('TALKING');
    }, 200);
  };

  const releaseMic = () => {
    if (status !== 'TALKING') return;
    setStatus('IDLE');
    
    const payload = JSON.stringify({ clientId: myClientId, action: 'mic_freed' });
    clientRef.current.publish(`skytrac/talkgroup/${activeChannelId}`, payload);
  };

  return { 
    status, 
    requestMic, 
    releaseMic,
    client: clientRef.current 
   };
}