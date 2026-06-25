// src/App.tsx (updated)
import Sidebar from "./components/Sidebar";

function App() {
  return (
    <div className="flex min-h-screen bg-black">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen flex flex-col items-center justify-center p-4">
        <div className="max-w-2xl text-center space-y-4">
          <h1 className="text-7xl md:text-8xl font-bold tracking-wide font-anton bg-linear-to-r from-(--color-purple-accent) to-white bg-clip-text text-transparent">
            Solyn
          </h1>
          <p className="text-lg md:text-xl leading-relaxed max-w-lg mx-auto text-white">
            A clarity-driven AI for solving complex problems and simplifying
            everyday work.
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;
