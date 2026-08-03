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

  const handleNavigate = (view: View) => {
    setCurrentView(view);
  };

  const renderContent = () => {
    switch (currentView) {
      case "models":
        return <ModelInterface />;
      case "history":
        return (
          <ChatHistoryInterface
            onNavigateToChat={() => handleNavigate("chat")}
          />
        );
      case "chat":
      default:
        return <ChatInterface />;
    }
  };

  return (
    <OllamaProvider>
      <OllamaStatusChecker>
        <div className="h-screen overflow-hidden bg-black">
          <TitleBar />
          <div className="flex h-full pt-10">
            <Sidebar
              onNavigate={handleNavigate}
              currentView={currentView}
              isCollapsed={isSidebarCollapsed}
              onToggleCollapse={() =>
                setIsSidebarCollapsed(!isSidebarCollapsed)
              }
            />
            <main
              className={`flex-1 transition-all duration-300 scrollable-content overflow-y-auto ${
                isSidebarCollapsed ? "ml-16" : "ml-64"
              }`}
            >
              {renderContent()}
            </main>
          </div>
        </div>
      </OllamaStatusChecker>
    </OllamaProvider>
  );
};

export default App;
