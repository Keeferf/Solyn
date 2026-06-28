// src/App.tsx
import { useState } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ModelInterface } from "@/components/models/ModelInterface";
import { OllamaProvider } from "@/contexts/OllamaContext";

type View = "chat" | "models";

export const App = () => {
  const [currentView, setCurrentView] = useState<View>("chat");

  const renderContent = () => {
    switch (currentView) {
      case "models":
        return <ModelInterface />;
      case "chat":
      default:
        return (
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
        );
    }
  };

  return (
    <OllamaProvider>
      <div className="flex min-h-screen bg-black">
        <Sidebar onNavigate={setCurrentView} currentView={currentView} />
        <main className="flex-1 ml-64 min-h-screen flex flex-col items-center justify-center p-4">
          {renderContent()}
        </main>
      </div>
    </OllamaProvider>
  );
};

export default App;
