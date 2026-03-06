import React, { useRef } from "react";
import { FiRefreshCw } from "react-icons/fi";
import api from "./utils/api";
import LiveWaveform from "./components/LiveWaveform";
import TalkButton from "./components/TalkButton";
import ExtendWindow from "./components/ExtendWindow";
import useFloorControl from "./hooks/useFloorControl";
import LoginPage from "./components/LoginPage";
import useAudioStreaming from "./hooks/useAudioStreaming";
import AdminPortal from "./components/Adminportal";

const CHANNELS = [
  { id: "1", name: "Channel 1" },
  { id: "2", name: "Channel 2" },
  { id: "3", name: "Channel 3" },
  { id: "4", name: "Channel 4" },
];

// Utility to check/request mic permission
async function ensureMicPermission() {
  if (!navigator?.permissions || !navigator?.mediaDevices) return;
  try {
    const status = await navigator.permissions.query({ name: 'microphone' });
    if (status.state === 'granted') return; // Already granted
    if (status.state === 'prompt') {
      // Will prompt user
      await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    // If denied, optionally alert
    if (status.state === 'denied') {
      alert('Microphone permission is required to use talk features. Please enable it in your browser or app settings.');
    }
  } catch (err) {
    // Fallback: try to prompt
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      alert('Microphone permission is required to use talk features.');
    }
  }
}


function App() {
  const [pairingTimeout, setPairingTimeout] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeChannelId, setActiveChannelId] = React.useState(CHANNELS[0].id);
  const [connectionStatus, setConnectionStatus] = React.useState("connecting"); // connecting | connected | error
  const [deviceStatus, setDeviceStatus] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [mode, setMode] = React.useState('skylink'); // 'skylink' or 'system'
  // Persist user
  const [user, setUser] = React.useState(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  });
  const [authForm, setAuthForm] = React.useState({ email: '', password: '' });
  const [authError, setAuthError] = React.useState(null);
  const [rooms, setRooms] = React.useState([]);
  const [roomForm, setRoomForm] = React.useState({ name: '', isPublic: true });
  const [roomError, setRoomError] = React.useState(null);
  const [adminOpen, setAdminOpen] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return !!stored;
    } catch { return false; }
  });
  const [currentUser, setCurrentUser] = React.useState(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  });
  const handleAdminLogin = (user) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    setUser(user);
    try {
      localStorage.setItem('user', JSON.stringify(user));
    } catch {}
  };

  const [users, setUsers] = React.useState([
    { id: "u1", email: "user@uottawa.ca" },
  ]);

  React.useEffect(() => {
    ensureMicPermission();
  }, []);

  // Connect to Skylink on mount with default creds
  React.useEffect(() => {
    let cancelled = false;
    let timeoutId;
    if (mode === 'skylink') {
      setConnectionStatus('connecting');
      setError(null);
      setUser(null);
      setRooms([]);
      setPairingTimeout(false);
      // Set timeout for pairing (e.g., 5 seconds)
      timeoutId = setTimeout(() => {
        if (!cancelled && connectionStatus === 'connecting') {
          setPairingTimeout(true);
          setConnectionStatus('error');
          setError('Try pairing again.');
        }
      }, 5000);
      (async () => {
        try {
          await api.login('skytrac', 'skytrac');
          if (cancelled) return;
          clearTimeout(timeoutId);
          setConnectionStatus('connected');
        } catch (e) {
          if (cancelled) return;
          clearTimeout(timeoutId);
          setConnectionStatus('error');
          setError('Failed to pair: ' + (e.message || e.toString()));
        }
      })();
    } else {
      setConnectionStatus('system');
      setError(null);
      setDeviceStatus(null);
      setPairingTimeout(false);
    }
    return () => { cancelled = true; clearTimeout(timeoutId); };
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
      setCurrentUser(data);
      setIsLoggedIn(true);
      try {
        localStorage.setItem('user', JSON.stringify(data));
      } catch {}
      setAuthForm({ email: '', password: '' });
    } catch (e) {
      setAuthError(e.message);
    }
  };
  const handleLogout = () => {
    setUser(null);
    setCurrentUser(null);
    setIsLoggedIn(false);
    setRooms([]);
    try {
      localStorage.removeItem('user');
    } catch {}
    // Optionally clear JWT
    if (api.setJwt) api.setJwt(null);
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
  // Only connect to MQTT if user is logged in (system mode)
  const shouldConnect = mode === 'system' && !!user;
  const { status, requestMic, releaseMic, client } = useFloorControl(activeChannelId, shouldConnect);
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
    <div className="relative min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col justify-end items-center p-6">
      <audio ref={audioPlayerRef} autoPlay playsInline style={{ display: "none" }} />
      <div className="w-full flex items-center justify-between px-4 pt-2">
        <div className="flex-shrink-0">
          <img
            src={connectionStatus === "connected" ? "/green-sat.png" : "/red-sat.png"}
            alt={connectionStatus === "connected" ? "Connected to Skylink" : "Not connected to Skylink"}
            className="w-14 h-14 drop-shadow"
          />
        </div>

        <h1 className="text-4xl font-bold drop-shadow-lg text-center flex-1">Talkio</h1>
        <div className="flex-shrink-0">
          <button onClick={() => setDrawerOpen(true)} className="flex flex-col gap-1">
            <span className="w-8 h-1 bg-black rounded"></span>
            <span className="w-8 h-1 bg-black rounded"></span>
            <span className="w-8 h-1 bg-black rounded"></span>
          </button>
        </div>
      </div>
          <div className="flex-1 w-full flex flex-col items-center mt-5">
            <div className="mt-4 flex items-center gap-2">
              {connectionStatus === "connecting" && (
                <span className="text-blue-600">Status: Connecting...</span>
              )}
              {connectionStatus === "connected" && (
                <span className="text-green-600">Status: Paired</span>
              )}
              {connectionStatus === "error" && (
                <>
                  <span className="text-red-600">Status: Not paired</span>
                  <button
                    title="Retry pairing"
                    aria-label="Retry pairing"
                    className="ml-2 p-1 rounded hover:bg-red-100"
                    onClick={() => {
                      setConnectionStatus('connecting');
                      setError(null);
                      setPairingTimeout(false);
                      // retrigger effect by toggling mode
                      setMode((m) => m === 'skylink' ? 'system' : 'skylink');
                    }}
                  >
                    <FiRefreshCw className="h-5 w-5 text-red-600" />
                  </button>
                </>
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
        onOpenAdmin={() => setAdminOpen(true)}
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