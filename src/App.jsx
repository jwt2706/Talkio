import 'react'
import LiveWaveform from "./LiveWaveform";

function App() {

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 to-purple-200">
        <h1 className="text-4xl font-bold text-purple-700 mb-4 drop-shadow-lg">hey</h1>
        <div className="p-6 bg-white rounded-xl shadow-md text-gray-800 text-lg font-medium">
          hello
        </div>
      
      <LiveWaveform />
      </div>
      
    </>
  )
}

export default App
