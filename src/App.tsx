import { Sidebar } from "@/components/sidebar/Sidebar";
import { ChatInterface } from "@/components/chat/ChatInterface";

export const App = () => {
  return (
    <div className="flex min-h-screen bg-black">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-3xl mx-auto">
          {/* Welcome message - visible when no messages */}
          <div className="text-center space-y-4 mb-8">
            <h1 className="text-7xl md:text-8xl font-bold tracking-wide font-anton bg-linear-to-r from-(--color-purple-accent) to-white bg-clip-text text-transparent">
              Solyn
            </h1>
            <p className="text-lg md:text-xl leading-relaxed text-white/80">
              A clarity-driven AI for solving complex problems and simplifying
              everyday work.
            </p>
          </div>

          <ChatInterface />
        </div>
      </main>
    </div>
  );
};

export default App;
