import React from 'react';
import LiveWaveform from "./components/LiveWaveform";
import TalkButton from './components/TalkButton';
import ExtendWindow from './components/ExtendWindow';

const CHANNELS = [
  { id: "1", name: "Chanel 1"},
  { id: "2", name: "Chanel 2"},
  { id: "3", name: "Chanel 3"},
  { id: "4", name: "Chanel 4"},
];

function App() {
  const [waveformRunning, setWaveformRunning] = React.useState(false);

 
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [activeChannelId, setActiveChannelId] = React.useState(CHANNELS[0].id);

  const activeChannel = CHANNELS.find(c => c.id === activeChannelId);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col justify-end items-center">

      <div className="flex-1 w-full flex flex-col items-center mt-5">
        <div className="w-full flex justify-between items-center px-6">
          <h1 className="text-4xl font-bold mb-4 drop-shadow-lg">Talkio</h1>

          {/* Hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col gap-1"
          >
            <span className="w-6 h-0.5 bg-black rounded"></span>
            <span className="w-6 h-0.5 bg-black rounded"></span>
            <span className="w-6 h-0.5 bg-black rounded"></span>
          </button>
        </div>

        <p className="text-sm text-black/60">
          <span className="font-semibold">{activeChannel?.name}</span>
        </p>
      </div>
      
      <div className="w-full flex flex-col items-center gap-6 pb-12">
        <LiveWaveform running={waveformRunning} />

        <TalkButton onPress={() => setWaveformRunning(true)} onRelease={() => setWaveformRunning(false)} />
      </div>

      {/* Extend Window */}
      <ExtendWindow
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        channels={CHANNELS}
        activeChannelId={activeChannelId}
        onSelectChannel={(id) => {
          setActiveChannelId(id);
          setDrawerOpen(false);
          setWaveformRunning(false);
        }}
      />
    </div>
  );
}

export default App
