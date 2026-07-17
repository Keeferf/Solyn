import { useState, useRef, useEffect } from "react";
import {
  FiSearch,
  FiX,
  FiDownloadCloud,
  FiThumbsUp,
  FiClock,
} from "react-icons/fi";
import { useMaintainFocus } from "./hooks/useMaintainFocus";

interface ModelToolbarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClearSearch: () => void;
  currentFilter: string;
  onFilterChange: (filter: string) => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  filterOptions?: Array<{
    value: string;
    label: string;
    icon: React.ComponentType<{ size?: number }>;
  }>;
}

const defaultFilterOptions = [
  { value: "most_downloads", label: "Most Downloads", icon: FiDownloadCloud },
  { value: "most_liked", label: "Most Liked", icon: FiThumbsUp },
  { value: "recent", label: "Recent", icon: FiClock },
];

// Minimum characters required before triggering a search
const MIN_SEARCH_CHARS = 3;

export const ModelToolbar = ({
  searchQuery,
  onSearchChange,
  onClearSearch,
  currentFilter,
  onFilterChange,
  loading = false,
  disabled = false,
  placeholder = "Search models by name, author, or description...",
  filterOptions = defaultFilterOptions,
}: ModelToolbarProps) => {
  // Local state for immediate input updates
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use the maintain focus hook
  const inputRef = useMaintainFocus<HTMLInputElement>();

  // Additional focus maintenance during loading/loading states
  useEffect(() => {
    // Only run this effect when loading is true (search is in progress)
    if (loading && inputRef.current) {
      // Store the input element reference
      const input = inputRef.current;

      // Function to restore focus if lost
      const restoreFocus = () => {
        if (
          input &&
          document.activeElement !== input &&
          document.contains(input)
        ) {
          // Small delay to let DOM settle
          setTimeout(() => {
            if (
              input &&
              document.activeElement !== input &&
              document.contains(input)
            ) {
              input.focus();
            }
          }, 10);
        }
      };

      // Listen for focusout events to catch focus loss
      const handleFocusOut = (_e: FocusEvent) => {
        // Prefix with underscore
        // If focus is moving to something else and we're still loading
        if (loading && input && document.activeElement !== input) {
          // Schedule focus restoration
          restoreFocus();
        }
      };

      // Also watch for DOM changes that might steal focus
      const observer = new MutationObserver(() => {
        if (
          loading &&
          input &&
          document.activeElement !== input &&
          document.contains(input)
        ) {
          restoreFocus();
        }
      });

      // Observe the parent for changes
      const parent = input.parentElement?.parentElement;
      if (parent) {
        observer.observe(parent, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      }

      // Add event listener for focusout
      document.addEventListener("focusout", handleFocusOut);

      // Cleanup
      return () => {
        document.removeEventListener("focusout", handleFocusOut);
        observer.disconnect();
      };
    }
  }, [loading, inputRef]);

  // Sync local state when search is cleared externally
  useEffect(() => {
    if (searchQuery === "" && localQuery !== "") {
      setLocalQuery("");
    }
  }, [searchQuery]);

  // Handle input change - updates instantly, debounces API call
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;

    // Update local state immediately (keeps input responsive)
    setLocalQuery(newValue);

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce the actual search API call
    debounceTimerRef.current = setTimeout(() => {
      // Only trigger search if:
      // 1. We have at least MIN_SEARCH_CHARS characters, OR
      // 2. The search is being cleared (empty string)
      if (newValue.length >= MIN_SEARCH_CHARS || newValue === "") {
        onSearchChange(newValue);
      }
    }, 300);
  };

  // Handle clear search
  const handleClear = () => {
    setLocalQuery("");
    onClearSearch();
    // Focus the input after clearing (handled by the hook)
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Search Bar */}
      <div className="relative flex-1">
        <div className="relative">
          <FiSearch
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
            size={16}
          />
          <input
            ref={inputRef}
            type="text"
            value={localQuery}
            onChange={handleInputChange}
            placeholder={placeholder}
            className="w-full bg-black/50 border border-white/10 rounded-lg px-10 py-2.5 text-white text-sm placeholder:text-white/30 focus:outline-none focus:border-purple-accent focus:ring-2 focus:ring-purple-accent transition-all"
            disabled={disabled || loading}
          />
          {localQuery && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors cursor-pointer"
              aria-label="Clear search"
            >
              <FiX size={16} />
            </button>
          )}
        </div>
        {/* Show hint about minimum characters */}
        {localQuery.length > 0 && localQuery.length < MIN_SEARCH_CHARS && (
          <p className="text-xs text-white/30 mt-1 ml-3">
            Type at least {MIN_SEARCH_CHARS} characters to search
          </p>
        )}
      </div>

      {/* Filter Buttons */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        {filterOptions.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => onFilterChange(value)}
            disabled={disabled || loading}
            className={`px-3 py-2.5 rounded-lg text-xs transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
              disabled || loading ? "opacity-50 cursor-not-allowed" : ""
            } ${
              currentFilter === value
                ? "bg-purple-accent text-white border border-purple-accent"
                : "bg-black/50 text-white/60 hover:bg-white/10 hover:text-white border border-white/10"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
};
