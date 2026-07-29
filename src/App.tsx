import { useState } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ChatHistoryInterface } from "@/components/chat/ChatHistoryInterface";
import { ModelInterface } from "@/components/models/ModelInterface";
import { OllamaProvider } from "@/contexts/OllamaContext";
import { OllamaStatusChecker } from "@/contexts/OllamaStatusChecker";

type View = "chat" | "history" | "models";

export const App = () => {
  const [currentView, setCurrentView] = useState<View>("chat");

  const renderContent = () => {
    switch (currentView) {
      case "models":
        return <ModelInterface />;
      case "history":
        return <ChatHistoryInterface />;
      case "chat":
      default:
        return <ChatInterface />;
    }
  };

  return (
    <OllamaProvider>
      <OllamaStatusChecker>
        <div className="flex min-h-screen bg-black">
          <Sidebar onNavigate={setCurrentView} currentView={currentView} />
          <main className="flex-1 ml-64 min-h-screen flex items-center justify-center p-4">
            {renderContent()}
          </main>
        </div>
      </OllamaStatusChecker>
    </OllamaProvider>
  );
};

export default App;
