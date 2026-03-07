import React from "react";
import { FiRefreshCw } from "react-icons/fi";
import api from "./utils/api";
import LiveWaveform from "./components/LiveWaveform";
import TalkButton from "./components/TalkButton";
import ExtendWindow from "./components/ExtendWindow";
import useFloorControl from "./hooks/useFloorControl";
import LoginPage from "./components/LoginPage";
import { usePttAudioTx } from "./audio/usePttAudioTx";
import { usePttAudioRx } from "./audio/usePttAudioRx";
import AdminPortal from "./components/Adminportal";

const DEFAULT_CHANNELS = [
  { id: "1", name: "Channel 1" },
  { id: "2", name: "Channel 2" },
  { id: "3", name: "Channel 3" },
  { id: "4", name: "Channel 4" },
];

function makeSsrc32() {
  return (Math.random() * 0xffffffff) >>> 0;
}

async function ensureMicPermission() {
  if (!navigator?.permissions || !navigator?.mediaDevices) return;

  try {
    const status = await navigator.permissions.query({ name: "microphone" });
    if (status.state === "granted") return;

    if (status.state === "prompt") {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      return;
    }

    if (status.state === "denied") {
      alert(
        "Microphone permission is required to use talk features. Please enable it in your browser or app settings."
      );
    }
  } catch {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      alert("Microphone permission is required to use talk features.");
    }
  }
}

function App() {
  const [pairingTimeout, setPairingTimeout] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const [channels, setChannels] = React.useState(DEFAULT_CHANNELS);
  const [activeChannelId, setActiveChannelId] = React.useState(
    DEFAULT_CHANNELS[0].id
  );

  const [connectionStatus, setConnectionStatus] = React.useState("connecting"); // connecting | connected | error
  const [deviceStatus, setDeviceStatus] = React.useState(null);
  const [error, setError] = React.useState(null);
  const [mode, setMode] = React.useState("skylink"); // 'skylink' or 'system'

  const [user, setUser] = React.useState(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  });

  const [authForm, setAuthForm] = React.useState({ email: "", password: "" });
  const [authError, setAuthError] = React.useState(null);
  const [rooms, setRooms] = React.useState([]);
  const [roomForm, setRoomForm] = React.useState({ name: "", isPublic: true });
  const [roomError, setRoomError] = React.useState(null);

  const [adminOpen, setAdminOpen] = React.useState(false);
  const [isLoggedIn, setIsLoggedIn] = React.useState(() => {
    try {
      return !!localStorage.getItem("user");
    } catch {
      return false;
    }
  });

  const [currentUser, setCurrentUser] = React.useState(() => {
    try {
      const stored = localStorage.getItem("user");
      if (stored) return JSON.parse(stored);
    } catch {}
    return null;
  });

  const [users, setUsers] = React.useState([{ id: "u1", email: "user@uottawa.ca" }]);
  const [memberships, setMemberships] = React.useState({});

  const activeChannel = channels.find((c) => c.id === activeChannelId);
  const mySsrc = React.useMemo(() => makeSsrc32(), []);

  const handleAdminLogin = (loginUser) => {
    setCurrentUser(loginUser);
    setIsLoggedIn(true);
    setUser(loginUser);
    try {
      localStorage.setItem("user", JSON.stringify(loginUser));
    } catch {}
  };

  const handleLogin = async () => {
    setAuthError(null);
    try {
      const data = await api.userLogin(authForm.email, authForm.password);
      setUser(data);
      setCurrentUser(data);
      setIsLoggedIn(true);
      try {
        localStorage.setItem("user", JSON.stringify(data));
      } catch {}
      setAuthForm({ email: "", password: "" });
    } catch (e) {
      setAuthError(e.message);
    }
  };

  const handleRegister = async () => {
    setAuthError(null);
    try {
      await api.register(authForm.email, authForm.password);
      await handleLogin();
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
      localStorage.removeItem("user");
    } catch {}
    if (api.setJwt) api.setJwt(null);
  };

  const handleCreateRoom = async () => {
    setRoomError(null);
    try {
      await api.createRoom(roomForm.name, roomForm.isPublic);
      setRoomForm({ name: "", isPublic: true });
      setRooms(await api.getRooms());
    } catch (e) {
      setRoomError(e.message);
    }
  };

  React.useEffect(() => {
    ensureMicPermission();
  }, []);

  // Skylink pairing / mode handling
  React.useEffect(() => {
    let cancelled = false;
    let timeoutId = null;

    if (mode === "skylink") {
      setConnectionStatus("connecting");
      setError(null);
      setPairingTimeout(false);

      timeoutId = setTimeout(() => {
        if (!cancelled) {
          setPairingTimeout(true);
          setConnectionStatus("error");
          setError("Try pairing again.");
        }
      }, 5000);

      (async () => {
        try {
          await api.login("skytrac", "skytrac");
          if (cancelled) return;
          clearTimeout(timeoutId);
          setConnectionStatus("connected");
        } catch (e) {
          if (cancelled) return;
          clearTimeout(timeoutId);
          setConnectionStatus("error");
          setError("Failed to pair: " + (e.message || e.toString()));
        }
      })();
    } else {
      setConnectionStatus("system");
      setError(null);
      setDeviceStatus(null);
      setPairingTimeout(false);
    }

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [mode]);

  // Fetch rooms in system mode
  React.useEffect(() => {
    if (mode !== "system" || !user) return;

    (async () => {
      try {
        setRooms(await api.getRooms());
      } catch {
        setRoomError("Failed to fetch rooms");
      }
    })();
  }, [mode, user]);

  // MQTT floor control
  const { status, requestMic, releaseMic, client, isConnected } =
    useFloorControl(activeChannelId);

  // RX: always listen on selected channel
  usePttAudioRx({
    mqttClient: client,
    channelId: activeChannelId,
    mySsrc,
  });

  // TX: only while talking
  usePttAudioTx({
    mqttClient: client,
    channelId: activeChannelId,
    talking: status === "TALKING",
    ssrc: mySsrc,
  });

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col justify-end items-center">
      <div className="w-full flex items-center justify-between px-4 pt-2">
        <div className="flex-shrink-0">
          <img
            src={connectionStatus === "connected" ? "/green-sat.png" : "/red-sat.png"}
            alt={
              connectionStatus === "connected"
                ? "Connected to Skylink"
                : "Not connected to Skylink"
            }
            className="w-14 h-14 drop-shadow"
          />
        </div>

        <h1 className="text-4xl font-bold drop-shadow-lg text-center flex-1">
          Talkio
        </h1>

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
                  setConnectionStatus("connecting");
                  setError(null);
                  setPairingTimeout(false);
                  setMode((m) => (m === "skylink" ? "system" : "skylink"));
                }}
              >
                <FiRefreshCw className="h-5 w-5 text-red-600" />
              </button>
            </>
          )}
        </div>

        <p className="text-sm text-black/60 mt-2">
          <span className="font-semibold">{activeChannel?.name}</span>
        </p>

        <p className="text-xs text-black/50 mt-1">
          MQTT: {isConnected ? "Connected" : "Disconnected"}
        </p>

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

        {connectionStatus === "error" && error && (
          <p className="mt-3 text-sm text-red-700">{error}</p>
        )}
      </div>

      <div className="w-full flex flex-col items-center gap-6 pb-12">
        <LiveWaveform running={status === "TALKING"} />
        <TalkButton status={status} onPress={requestMic} onRelease={releaseMic} />
      </div>

      <LoginPage open={!isLoggedIn} onLogin={handleAdminLogin} />

      <ExtendWindow
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        channels={channels}
        activeChannelId={activeChannelId}
        onSelectChannel={(id) => {
          setActiveChannelId(id);
          setDrawerOpen(false);
        }}
        onCreateChannel={(newChannel) => {
          setChannels((prev) => [...prev, newChannel]);
          setActiveChannelId(newChannel.id);
          setDrawerOpen(false);
        }}
        onOpenAdmin={() => setAdminOpen(true)}
        onLogout={handleLogout}
      />

      <AdminPortal
        open={adminOpen}
        onClose={() => setAdminOpen(false)}
        channels={channels}
        users={users}
        setUsers={setUsers}
        memberships={memberships}
        setMemberships={setMemberships}
      />
    </div>
  );
}

export default App;