import React, { useRef } from "react";
import api from "./utils/api";
import LiveWaveform from "./components/LiveWaveform";
import TalkButton from "./components/TalkButton";
import ExtendWindow from "./components/ExtendWindow";
import useFloorControl from "./hooks/useFloorControl";
import LoginPage from "./components/LoginPage";
import useAudioStreaming from "./hooks/useAudioStreaming";

// Admin portal overlay (inside the app, no router)
import AdminPortal from "./components/Adminportal";

const CHANNELS = [
  { id: "1", name: "Channel 1" },
  { id: "2", name: "Channel 2" },
  { id: "3", name: "Channel 3" },
  { id: "4", name: "Channel 4" },
];

function App() {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeChannelId, setActiveChannelId] = React.useState(CHANNELS[0].id);

  const [connectionStatus, setConnectionStatus] = React.useState("connecting"); // connecting | connected | error
  const [deviceStatus, setDeviceStatus] = React.useState(null);
  const [error, setError] = React.useState(null);
  // System user state
  const [mode, setMode] = React.useState('skylink'); // 'skylink' or 'system'
  const [user, setUser] = React.useState(null); // { email, uuid, token }
  const [authForm, setAuthForm] = React.useState({ email: '', password: '' });
  const [authError, setAuthError] = React.useState(null);
  const [rooms, setRooms] = React.useState([]);
  const [roomForm, setRoomForm] = React.useState({ name: '', isPublic: true });
  const [roomError, setRoomError] = React.useState(null);

  // Admin portal open/close
  const [adminOpen, setAdminOpen] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState(null);
  const handleAdminLogin = (user) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
  };
  // Users are created by email (portal manages these)
  const [users, setUsers] = React.useState([
    { id: "u1", email: "user@uottawa.ca" },
  ]);

  // Connect to Skylink on mount with default creds
  React.useEffect(() => {
    let cancelled = false;
    if (mode === 'skylink') {
      api.setApiBase('http://192.168.111.1:3000');
      setConnectionStatus('connecting');
      setError(null);
      setUser(null);
      setRooms([]);
      (async () => {
        try {
          await api.login('skytrac', 'skytrac');
          if (cancelled) return;
          setConnectionStatus('connected');
        } catch (e) {
          if (cancelled) return;
          setConnectionStatus('error');
          setError('Failed to pair: ' + (e.message || e.toString()));
        }
      })();
    } else {
      api.setApiBase('http://localhost:4000/api'); // Change to your backend
      setConnectionStatus('system');
      setError(null);
      setDeviceStatus(null);
    }
    return () => { cancelled = true; };
  }, [mode]);

  // Fetch rooms when logged in (system mode)
  React.useEffect(() => {
    if (mode !== 'system' || !user) return;
    (async () => {
      try {
        setRooms(await api.getRooms());
      } catch (e) {
        setRoomError('Failed to fetch rooms');
      }
    })();
  }, [mode, user]);

  // Auth handlers (system mode)
  const handleRegister = async () => {
    setAuthError(null);
    try {
      await api.register(authForm.email, authForm.password);
      await handleLogin();
    } catch (e) {
      setAuthError(e.message);
    }
  };
  const handleLogin = async () => {
    setAuthError(null);
    try {
      const data = await api.userLogin(authForm.email, authForm.password);
      setUser(data);
      setAuthForm({ email: '', password: '' });
    } catch (e) {
      setAuthError(e.message);
    }
  };
  const handleLogout = () => {
    setUser(null);
    setRooms([]);
  };

  // Room handlers (system mode)
  const handleCreateRoom = async () => {
    setRoomError(null);
    try {
      await api.createRoom(roomForm.name, roomForm.isPublic);
      setRoomForm({ name: '', isPublic: true });
      setRooms(await api.getRooms());
    } catch (e) {
      setRoomError(e.message);
    }
  };

  // 1. Tạo Ref để móc vào thẻ audio vật lý trên giao diện
  const [memberships, setMemberships] = React.useState({});
  const audioPlayerRef = useRef(null);
  const activeChannel = CHANNELS.find((c) => c.id === activeChannelId);
  const myAudioId = React.useMemo(() => Math.floor(Math.random() * 256), []);
  const { status, requestMic, releaseMic, client } = useFloorControl(activeChannelId);
  const { startRecording, stopRecording } = useAudioStreaming(client, activeChannelId, myAudioId);

  React.useEffect(() => {
    if (status === "TALKING") {
      startRecording();
    } else {
      stopRecording();
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

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

      mediaSource.addEventListener("sourceopen", () => {
        isSourceOpen = true;
        sourceBuffer = mediaSource.addSourceBuffer('audio/webm; codecs="opus"');

        sourceBuffer.addEventListener("updateend", () => {
          if (chunkQueue.length > 0 && !sourceBuffer.updating) {
            try {
              sourceBuffer.appendBuffer(chunkQueue.shift());
              if (audioEl.paused) audioEl.play().catch(() => {});
            } catch (e) {
              console.warn("Lỗi phát hàng đợi:", e);
            }
          }
        });

        // Nếu có chunk đến sớm đang xếp hàng, đẩy vào luôn
        if (chunkQueue.length > 0 && !sourceBuffer.updating) {
          try {
            sourceBuffer.appendBuffer(chunkQueue.shift());
          } catch (e) {}
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
        const isHeader =
          chunk.length >= 4 &&
          chunk[0] === 0x1a &&
          chunk[1] === 0x45 &&
          chunk[2] === 0xdf &&
          chunk[3] === 0xa3;

        if (isHeader) {
          console.log("🔥 Phát hiện Header mới! Đang thiết lập kênh truyền...");
          resetAudioEnvironment();
        }

        // Đổ dữ liệu vào phễu
        if (isSourceOpen && sourceBuffer && !sourceBuffer.updating) {
          try {
            sourceBuffer.appendBuffer(chunk);
            if (audioEl.paused) audioEl.play().catch(() => {});
          } catch (e) {
            console.warn("Lỗi ghép chunk, tạm thời bỏ qua đoạn vỡ tiếng này...");
          }
        } else {
          // Phễu chưa mở xong thì cho xếp hàng
          chunkQueue.push(chunk);
        }
      }
    };

    client.on("message", handleMessage);

    return () => {
      client.unsubscribe(audioTopic);
      client.removeListener("message", handleMessage);
    };
  }, [client, activeChannelId, myAudioId]);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col justify-end items-center">
      {/* Mode switcher */}
      <div className="absolute top-2 right-2 z-50">
        <button
          className={`px-3 py-1 rounded-l ${mode === 'skylink' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border'}`}
          onClick={() => setMode('skylink')}
        >Skylink</button>
        <button
          className={`px-3 py-1 rounded-r ${mode === 'system' ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border'}`}
          onClick={() => setMode('system')}
        >System</button>
      </div>

      {/* 3. Thẻ Audio vật lý ẩn trên giao diện (Vượt rào Mobile) */}
      <audio ref={audioPlayerRef} autoPlay playsInline style={{ display: "none" }} />

      {/* Header row ... (Giữ nguyên code của bạn) */}
      <div className="w-full flex items-center justify-between px-4 pt-2">
        <div className="flex-shrink-0">
          <img
            src={connectionStatus === "connected" ? "/green-sat.png" : "/red-sat.png"}
            alt={connectionStatus === "connected" ? "Connected to Skylink" : "Not connected to Skylink"}
            className="w-14 h-14 drop-shadow"
          />
        </div>

        {/* Centered title */}
        <h1 className="text-4xl font-bold drop-shadow-lg text-center flex-1">Talkio</h1>

        {/* Hamburger menu */}
        <div className="flex-shrink-0">
          <button onClick={() => setDrawerOpen(true)} className="flex flex-col gap-1">
            <span className="w-8 h-1 bg-black rounded"></span>
            <span className="w-8 h-1 bg-black rounded"></span>
            <span className="w-8 h-1 bg-black rounded"></span>
          </button>
        </div>
      </div>

      {/* System mode: Auth and rooms UI */}
      {mode === 'system' && (
        <div className="w-full max-w-md mx-auto mt-8 bg-white/80 rounded shadow p-6 flex flex-col gap-4">
          {!user ? (
            <>
              <h2 className="text-xl font-bold">Login or Register</h2>
              <input
                className="border rounded px-2 py-1"
                placeholder="Email"
                value={authForm.email}
                onChange={e => setAuthForm(f => ({ ...f, email: e.target.value }))}
              />
              <input
                className="border rounded px-2 py-1"
                placeholder="Password"
                type="password"
                value={authForm.password}
                onChange={e => setAuthForm(f => ({ ...f, password: e.target.value }))}
              />
              <div className="flex gap-2">
                <button className="bg-blue-600 text-white rounded px-4 py-2" onClick={handleLogin}>Login</button>
                <button className="bg-gray-400 text-white rounded px-4 py-2" onClick={handleRegister}>Register</button>
              </div>
              {authError && <div className="text-red-600 text-sm">{authError}</div>}
            </>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <span className="font-semibold">Logged in as {user.email}</span>
                <button className="text-blue-600 underline" onClick={handleLogout}>Logout</button>
              </div>
              <h2 className="text-lg font-bold mt-4">Rooms</h2>
              <div className="flex gap-2 mb-2">
                <input
                  className="border rounded px-2 py-1 flex-1"
                  placeholder="Room name"
                  value={roomForm.name}
                  onChange={e => setRoomForm(f => ({ ...f, name: e.target.value }))}
                />
                <select
                  className="border rounded px-2 py-1"
                  value={roomForm.isPublic ? 'public' : 'private'}
                  onChange={e => setRoomForm(f => ({ ...f, isPublic: e.target.value === 'public' }))}
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
                <button className="bg-green-600 text-white rounded px-4 py-1" onClick={handleCreateRoom}>Create</button>
              </div>
              {roomError && <div className="text-red-600 text-sm">{roomError}</div>}
              <ul className="divide-y">
                {rooms.map(room => (
                  <li key={room.roomUuid} className="py-2 flex flex-col">
                    <span className="font-semibold">{room.name}</span>
                    <span className="text-xs text-gray-600">{room.isPublic ? 'Public' : 'Private'} | Admin: {room.adminUuid === user.uuid ? 'You' : room.adminUuid}</span>
                    <span className="text-xs text-gray-600">Room UUID: {room.roomUuid}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Skylink mode: original UI */}
      {mode === 'skylink' && (
        <>
          <div className="flex-1 w-full flex flex-col items-center mt-5">
            {/* Connection status */}
            <div className="mt-4">
              {connectionStatus === "connecting" && (
                <span className="text-blue-600">Status: Connecting...</span>
              )}
              {connectionStatus === "connected" && (
                <span className="text-green-600">Status: Paired</span>
              )}
              {connectionStatus === "error" && (
                <span className="text-red-600">Status: Disconnected</span>
              )}
            </div>

            {/* Optional error */}
            {connectionStatus === "error" && error && (
              <p className="mt-3 text-sm text-red-700">{error}</p>
            )}
          </div>

          <div className="w-full flex flex-col items-center gap-6 pb-12">
            <LiveWaveform running={status === "TALKING"} />
            <TalkButton status={status} onPress={requestMic} onRelease={releaseMic} />
          </div>
          <LoginPage open={!isLoggedIn} onLogin={handleAdminLogin} />
          <p className="text-sm text-black/60">
            <span className="font-semibold">{activeChannel?.name}</span>
          </p>
        </>
      )}

      <ExtendWindow
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        channels={CHANNELS}
        activeChannelId={activeChannelId}
        onSelectChannel={(id) => {
          setActiveChannelId(id);
          setDrawerOpen(false);
        }}
        onCreateChannel={(newChannel) => {
          // add channel + switch to it
          setChannels((prev) => [...prev, newChannel]);
          setActiveChannelId(newChannel.id);
          setDrawerOpen(false);
        }}
      />

      {/* ✅ Admin Portal overlay inside the app */}
      <AdminPortal
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        channels={CHANNELS}
        users={users}
        setUsers={setUsers}
        memberships={memberships}
        setMemberships={setMemberships}
      />
    </div>
    
  );
}

export default App;