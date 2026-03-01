import { useState } from "react";

function App() {
  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Ghost Player
            </h1>
            <p className="text-sm text-gray-400">
              AI Board Game Opponent
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setMicOn(!micOn)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                micOn
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              }`}
            >
              <MicIcon />
              {micOn ? "Mic On" : "Mic Off"}
            </button>
            <button
              onClick={() => setCameraOn(!cameraOn)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                cameraOn
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200"
              }`}
            >
              <CameraIcon />
              {cameraOn ? "Camera On" : "Camera Off"}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl p-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Camera Feed */}
          <div className="lg:col-span-2">
            <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-gray-800 bg-gray-900">
              <CameraIcon className="h-12 w-12 text-gray-600" />
              <p className="mt-3 text-sm text-gray-500">Camera Feed</p>
              <p className="mt-1 text-xs text-gray-600">
                Point your camera at the board to begin
              </p>
            </div>
          </div>

          {/* Game State */}
          <div>
            <div className="flex h-96 flex-col items-center justify-center rounded-xl border border-gray-800 bg-gray-900">
              <BoardIcon className="h-12 w-12 text-gray-600" />
              <p className="mt-3 text-sm text-gray-500">Game State</p>
              <p className="mt-1 text-xs text-gray-600">
                No game in progress
              </p>
            </div>
          </div>
        </div>

        {/* Chat / Transcript Log */}
        <div className="mt-6">
          <div className="flex h-48 flex-col rounded-xl border border-gray-800 bg-gray-900">
            <div className="border-b border-gray-800 px-4 py-3">
              <h2 className="text-sm font-medium text-gray-400">
                Transcript
              </h2>
            </div>
            <div className="flex flex-1 items-center justify-center">
              <p className="text-sm text-gray-600">
                Start a conversation with Ghost Player...
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function MicIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function CameraIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

function BoardIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M3 12h18" />
      <path d="M12 3v18" />
    </svg>
  );
}

export default App;
