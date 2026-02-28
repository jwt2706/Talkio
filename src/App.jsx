import React from 'react';
import TalkButton from './components/TalkButton';

function App() {

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 flex flex-col justify-end items-center">
      <div className="flex-1 w-full flex flex-col items-center mt-5">
        <h1 className="text-4xl font-bold mb-4 drop-shadow-lg">Talkio</h1>
      </div>
      
      <div className="w-full flex justify-center pb-12">
        <TalkButton />
      </div>
    </div>
  );
}

export default App
