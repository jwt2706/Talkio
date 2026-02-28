import React from 'react';
import LiveWaveform from "./components/LiveWaveform";
import TalkButton from './components/TalkButton';

function App() {
  const [waveformRunning, setWaveformRunning] = React.useState(false);

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col justify-end items-center">
      <div className="flex-1 w-full flex flex-col items-center mt-5">
        <h1 className="text-4xl font-bold mb-4 drop-shadow-lg">Talkio</h1>
      </div>
      <div className="w-full flex flex-col items-center gap-6 pb-12">
        <LiveWaveform running={waveformRunning} />
        <TalkButton onPress={() => setWaveformRunning(true)} onRelease={() => setWaveformRunning(false)} />
      </div>
    </div>
  );
}

export default App
