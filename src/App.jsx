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

  // LOGIC NHẬN VÀ PHÁT AUDIO (PHIÊN BẢN CHỐNG ĐẠN - NHẬN DIỆN HEADER)
  React.useEffect(() => {
    if (!client || !audioPlayerRef.current) return;

    const audioTopic = `skytrac/audio/${activeChannelId}`;
    client.subscribe(audioTopic);

    const audioEl = audioPlayerRef.current;
    
    let mediaSource = null;
    let sourceBuffer = null;
    let chunkQueue = []; 
    let isSourceOpen = false;

    // Hàm đập đi xây lại hệ thống âm thanh
    const resetAudioEnvironment = () => {
      chunkQueue = [];
      isSourceOpen = false;
      sourceBuffer = null;

      mediaSource = new MediaSource();
      audioEl.src = URL.createObjectURL(mediaSource);

      mediaSource.addEventListener('sourceopen', () => {
        isSourceOpen = true;
        sourceBuffer = mediaSource.addSourceBuffer('audio/webm; codecs="opus"');

        sourceBuffer.addEventListener('updateend', () => {
          if (chunkQueue.length > 0 && !sourceBuffer.updating) {
            try {
              sourceBuffer.appendBuffer(chunkQueue.shift());
              if (audioEl.paused) audioEl.play().catch(()=>{});
            } catch(e) { console.warn("Lỗi phát hàng đợi:", e); }
          }
        });

        // Nếu có chunk đến sớm đang xếp hàng, đẩy vào luôn
        if (chunkQueue.length > 0 && !sourceBuffer.updating) {
          try { sourceBuffer.appendBuffer(chunkQueue.shift()); } catch(e){}
        }
      });
    };

    // Khởi tạo phễu lần đầu tiên
    resetAudioEnvironment();

    const handleMessage = (topic, message) => {
      if (topic === audioTopic) {
        const rawData = new Uint8Array(message);
        const senderId = rawData[0];
        
        if (senderId === myAudioId) return; // Bỏ qua giọng mình tự vang lại

        const chunk = rawData.slice(1);

        // NHẬN DIỆN "MAGIC BYTES" CỦA HEADER WEBM (0x1A 45 DF A3)
        const isHeader = chunk.length >= 4 && 
                         chunk[0] === 0x1A && 
                         chunk[1] === 0x45 && 
                         // Dùng Hexadecimal để dễ so sánh
                         chunk[2] === 0xDF && 
                         chunk[3] === 0xA3;

        if (isHeader) {
          console.log("🔥 Phát hiện Header mới! Đang thiết lập kênh truyền...");
          resetAudioEnvironment();
        }

        // Đổ dữ liệu vào phễu
        if (isSourceOpen && sourceBuffer && !sourceBuffer.updating) {
          try {
            sourceBuffer.appendBuffer(chunk);
            if (audioEl.paused) audioEl.play().catch(()=>{});
          } catch(e) {
            console.warn("Lỗi ghép chunk, tạm thời bỏ qua đoạn vỡ tiếng này...");
          }
        } else {
          // Phễu chưa mở xong thì cho xếp hàng
          chunkQueue.push(chunk);
        }
      }
    };

    client.on('message', handleMessage);

    return () => {
      client.unsubscribe(audioTopic);
      client.removeListener('message', handleMessage);
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
            src={
              connectionStatus === "connected"
                ? "/green-sat.png"
                : "/red-sat.png"
            }
            alt={
              connectionStatus === "connected"
                ? "Connected to Skylink"
                : "Not connected to Skylink"
            }
            className="w-14 h-14 drop-shadow"
          />
        </div>

        {/* Centered title */}
        <h1 className="text-4xl font-bold drop-shadow-lg text-center flex-1">
          Talkio
        </h1>

        {/* Hamburger menu */}
        <div className="flex-shrink-0">
          <button onClick={() => setDrawerOpen(true)} className="flex flex-col gap-1">
            <span className="w-8 h-1 bg-black rounded"></span>
            <span className="w-8 h-1 bg-black rounded"></span>
            <span className="w-8 h-1 bg-black rounded"></span>
          </button>
        </div>
      </div>

      <div className="flex-1 w-full flex flex-col items-center mt-5">
        {/* Connection status */}
        <div className="mt-4">
          {connectionStatus === "connecting" && (
            <span className="text-blue-600">Status: Connecting...</span>
          )}
          {connectionStatus === "connected" && (
            <span className="text-green-600">Status: Connected</span>
          )}
          {connectionStatus === "error" && (
            <span className="text-red-600">Status: Disconnected</span>
          )}
        </div>

        <p className="text-sm text-black/60">
          <span className="font-semibold">{activeChannel?.name}</span>
        </p>

        {/* Device status */}
        {connectionStatus === "connected" && deviceStatus && (
          <div className="mt-4 p-4 bg-white/80 rounded shadow text-black">
            <div>
              <b>Temperature:</b> {deviceStatus.temperature}°C
            </div>
            <div>
              <b>Uptime:</b> {deviceStatus.uptime} s
            </div>
            <div>
              <b>CPU Usage:</b> {deviceStatus.cpuUsage}%
            </div>
            <div>
              <b>Memory Usage:</b> {deviceStatus.memoryUsage}%
            </div>
            <div>
              <b>Storage Usage:</b> {deviceStatus.storageUsage}%
            </div>
          </div>
        )}

        {/* Optional error */}
        {connectionStatus === "error" && error && (
          <p className="mt-3 text-sm text-red-700">{error}</p>
        )}
      </div>
      
      <div className="w-full flex flex-col items-center gap-6 pb-12">
        <LiveWaveform running={status === 'TALKING'} />
        <TalkButton status={status} onPress={requestMic} onRelease={releaseMic} />
      </div>

      <ExtendWindow
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        channels={CHANNELS} // ✅ use state channels
        activeChannelId={activeChannelId}
        onSelectChannel={(id) => {
          setActiveChannelId(id);
          setDrawerOpen(false);
          // Đã xóa setWaveformRunning(false) ở đây
        }}
        onCreateChannel={(newChannel) => {
          // ✅ add channel + switch to it
          setChannels((prev) => [...prev, newChannel]);
          setActiveChannelId(newChannel.id);
          setDrawerOpen(false);
        }}
      />
    </div>
  );
}

export default App;