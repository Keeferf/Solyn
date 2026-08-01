import { useState } from "react";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { ChatInterface } from "@/components/chat/ChatInterface";
import { ChatHistoryInterface } from "@/components/history/ChatHistoryInterface";
import { ModelInterface } from "@/components/models/ModelInterface";
import { OllamaProvider } from "@/contexts/OllamaContext";
import { OllamaStatusChecker } from "@/contexts/OllamaStatusChecker";
import { TitleBar } from "@/components/ui/TitleBar";

type View = "chat" | "history" | "models";

export const App = () => {
  const [currentView, setCurrentView] = useState<View>("chat");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
        <div className="min-h-screen bg-black">
          <TitleBar />
          <Sidebar
            onNavigate={setCurrentView}
            currentView={currentView}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
          <main
            className={`min-h-screen transition-all duration-300 ${
              isSidebarCollapsed ? "ml-16" : "ml-64"
            }`}
          >
            <div className="pt-10 p-4 h-[calc(100vh-40px)] overflow-y-auto">
              {renderContent()}
            </div>
          </main>
        </div>
      </OllamaStatusChecker>
    </OllamaProvider>
  );
};

export default App;
