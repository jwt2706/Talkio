import React from "react";
import api from "./utils/api";
import LiveWaveform from "./components/LiveWaveform";
import TalkButton from "./components/TalkButton";
import ExtendWindow from "./components/ExtendWindow";
import useFloorControl from "./hooks/useFloorControl";
import LoginPage from "./components/LoginPage";

const INITIAL_CHANNELS = [
  { id: "1", name: "Channel 1" },
  { id: "2", name: "Channel 2" },
  { id: "3", name: "Channel 3" },
  { id: "4", name: "Channel 4" },
];

function App() {
  const [waveformRunning, setWaveformRunning] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  // ✅ channels are now state (so we can add new ones)
  const [channels, setChannels] = React.useState(INITIAL_CHANNELS);

  const [activeChannelId, setActiveChannelId] = React.useState(
    INITIAL_CHANNELS[0].id
  );
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [currentUser, setCurrentUser] = React.useState(null);
  const handleLogin = (user) => {
  setCurrentUser(user);
  setIsLoggedIn(true);
};
  const [connectionStatus, setConnectionStatus] = React.useState("connecting"); // connecting | connected | error
  const [deviceStatus, setDeviceStatus] = React.useState(null);
  const [error, setError] = React.useState(null);

  // ✅ use channels state
  const activeChannel = channels.find((c) => c.id === activeChannelId);

  const { status, requestMic, releaseMic } = useFloorControl(activeChannelId);

  React.useEffect(() => {
    async function connectAndFetch() {
      setConnectionStatus("connecting");
      setError(null);
      try {
        // Ping the device instead of login
        await api.ping();
        setConnectionStatus("connected");
        // Fetch device status
        await api.login("skytrac", "skytrac");
        const status = await api.getDiagnosticsStatus();
        setDeviceStatus(status);
      } catch (e) {
        setConnectionStatus("error");
        setError(e.message || "Connection failed");
      }
    }
    connectAndFetch();
  }, []);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col justify-end items-center">
      {/* Header row: sat icon, title, hamburger */}
      <div className="w-full flex items-center justify-between px-4 pt-2">
        {/* Satellite status icon */}
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
        <LiveWaveform running={status === "TALKING"} />
        <TalkButton status={status} onPress={requestMic} onRelease={releaseMic} />
      </div>
<LoginPage open={!isLoggedIn} onLogin={handleLogin} />
      {/* Extend Window */}
      <ExtendWindow
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        channels={channels} // use state channels
        activeChannelId={activeChannelId}
        onSelectChannel={(id) => {
          setActiveChannelId(id);
          setDrawerOpen(false);
          setWaveformRunning(false);
        }}
        onCreateChannel={(newChannel) => {
          // add channel + switch to it
          setChannels((prev) => [...prev, newChannel]);
          setActiveChannelId(newChannel.id);
          setDrawerOpen(false);
        }}
      />
    </div>
    
  );
}

export default App;