import React, { useRef } from 'react'; // Thêm useRef
import api from './utils/api';
import LiveWaveform from "./components/LiveWaveform";
import TalkButton from './components/TalkButton';
import ExtendWindow from './components/ExtendWindow';
import useFloorControl from './hooks/useFloorControl';
import useAudioStreaming from './hooks/useAudioStreaming';

const CHANNELS = [
  { id: "1", name: "Chanel 1"},
  { id: "2", name: "Chanel 2"},
  { id: "3", name: "Chanel 3"},
  { id: "4", name: "Chanel 4"},
];

function App() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeChannelId, setActiveChannelId] = React.useState(CHANNELS[0].id);
  const [connectionStatus, setConnectionStatus] = React.useState('connecting'); 
  const [deviceStatus, setDeviceStatus] = React.useState(null);
  const [error, setError] = React.useState(null);

  // 1. Tạo Ref để móc vào thẻ audio vật lý trên giao diện
  const audioPlayerRef = useRef(null);

  const activeChannel = CHANNELS.find(c => c.id === activeChannelId);
  const myAudioId = React.useMemo(() => Math.floor(Math.random() * 256), []);
  
  const { status, requestMic, releaseMic, client } = useFloorControl(activeChannelId);
  const { startRecording, stopRecording } = useAudioStreaming(client, activeChannelId, myAudioId);
  
  React.useEffect(() => {
    if (status === 'TALKING') {
      startRecording();
    } else {
      stopRecording();
    }
  }, [status]); 

  // LOGIC NHẬN VÀ PHÁT AUDIO (ĐÃ SỬA LỖI MOBILE VÀ MEMORY LEAK)
  React.useEffect(() => {
    // Phải đảm bảo thẻ audio trên giao diện đã load xong
    if (!client || !audioPlayerRef.current) return;

    const audioTopic = `skytrac/audio/${activeChannelId}`;
    client.subscribe(audioTopic);

    const mediaSource = new MediaSource();
    const audioEl = audioPlayerRef.current; // Sử dụng thẻ thực tế thay vì new Audio()
    
    // Tạo URL và gắn vào thẻ
    const objectUrl = URL.createObjectURL(mediaSource);
    audioEl.src = objectUrl;

    let sourceBuffer = null;
    let chunkQueue = []; 

    mediaSource.addEventListener('sourceopen', () => {
      sourceBuffer = mediaSource.addSourceBuffer('audio/webm; codecs="opus"');

      sourceBuffer.addEventListener('updateend', () => {
        if (chunkQueue.length > 0 && !sourceBuffer.updating) {
          sourceBuffer.appendBuffer(chunkQueue.shift());
          if (audioEl.paused) audioEl.play().catch(e => console.warn("Trình duyệt chặn phát:", e));
        }
      });
    });

    const handleMessage = (topic, message) => {
      if (topic === audioTopic) {
        const rawData = new Uint8Array(message);
        const senderId = rawData[0];
        
        if (senderId === myAudioId) return; 

        const chunk = rawData.slice(1);

        if (sourceBuffer && !sourceBuffer.updating) {
          try {
            sourceBuffer.appendBuffer(chunk);
            if (audioEl.paused) audioEl.play().catch(e => console.warn("Chờ tương tác chạm:", e));
          } catch(e) {
            console.error("Lỗi ghép chunk:", e);
          }
        } else {
          chunkQueue.push(chunk);
        }
      }
    };

    client.on('message', handleMessage);

    return () => {
      client.unsubscribe(audioTopic);
      client.removeListener('message', handleMessage);
      
      // 2. Dọn dẹp rác bộ nhớ khi đổi kênh
      URL.revokeObjectURL(objectUrl);
      audioEl.src = '';
    };
  }, [client, activeChannelId]);
  
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col justify-end items-center">
      
      {/* 3. Thẻ Audio vật lý ẩn trên giao diện (Vượt rào Mobile) */}
      <audio ref={audioPlayerRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* Header row ... (Giữ nguyên code của bạn) */}
      <div className="w-full flex items-center justify-between px-4 pt-2">
        <div className="flex-shrink-0">
          <img
            src={connectionStatus === 'connected' ? '/green-sat.png' : '/red-sat.png'}
            alt={connectionStatus === 'connected' ? 'Connected to Skylink' : 'Not connected to Skylink'}
            className="w-14 h-14 drop-shadow"
          />
        </div>
        <h1 className="text-4xl font-bold drop-shadow-lg text-center flex-1">Talkio</h1>
        <div className="flex-shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col gap-1"
          >
            <span className="w-8 h-1 bg-black rounded"></span>
            <span className="w-8 h-1 bg-black rounded"></span>
            <span className="w-8 h-1 bg-black rounded"></span>
          </button>
        </div>
      </div>

      <div className="flex-1 w-full flex flex-col items-center mt-5">
        <div className="mt-4">
          {connectionStatus === 'connecting' && <span className="text-blue-600">Status: Connecting...</span>}
          {connectionStatus === 'connected' && <span className="text-green-600">Status: Connected</span>}
          {connectionStatus === 'error' && <span className="text-red-600">Status: Disconnected</span>}
        </div>

        <p className="text-sm text-black/60">
          <span className="font-semibold">{activeChannel?.name}</span>
        </p>

        {connectionStatus === 'connected' && deviceStatus && (
          <div className="mt-4 p-4 bg-white/80 rounded shadow text-black">
            <div><b>Temperature:</b> {deviceStatus.temperature}°C</div>
            <div><b>Uptime:</b> {deviceStatus.uptime} s</div>
            <div><b>CPU Usage:</b> {deviceStatus.cpuUsage}%</div>
            <div><b>Memory Usage:</b> {deviceStatus.memoryUsage}%</div>
            <div><b>Storage Usage:</b> {deviceStatus.storageUsage}%</div>
          </div>
        )}
      </div>
      
      <div className="w-full flex flex-col items-center gap-6 pb-12">
        <LiveWaveform running={status === 'TALKING'} />
        <TalkButton status={status} onPress={requestMic} onRelease={releaseMic} />
      </div>

      <ExtendWindow
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        channels={CHANNELS}
        activeChannelId={activeChannelId}
        onSelectChannel={(id) => {
          setActiveChannelId(id);
          setDrawerOpen(false);
          // Đã xóa setWaveformRunning(false) ở đây
        }}
      />
    </div>
  );
}

export default App;