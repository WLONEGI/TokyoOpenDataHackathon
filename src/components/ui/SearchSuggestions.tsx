'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, Clock, MapPin, Tag } from 'lucide-react';

interface SearchSuggestion {
  id: string;
  text: string;
  type: 'recent' | 'popular' | 'location' | 'category';
  metadata?: {
    category?: string;
    location?: string;
    frequency?: number;
  };
}

interface SearchSuggestionsProps {
  query: string;
  onSuggestionSelect: (suggestion: string) => void;
  onQueryChange: (query: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

const SAMPLE_SUGGESTIONS: SearchSuggestion[] = [
  {
    id: '1',
    text: '保育園の申込み方法',
    type: 'popular',
    metadata: { category: 'childcare', frequency: 85 }
  },
  {
    id: '2',
    text: '近くの子育て支援センター',
    type: 'location',
    metadata: { category: 'childcare', location: 'nearby' }
  },
  {
    id: '3',
    text: '学童保育の利用条件',
    type: 'popular',
    metadata: { category: 'childcare', frequency: 72 }
  },
  {
    id: '4',
    text: '東京都の人口統計',
    type: 'recent',
    metadata: { category: 'statistics' }
  },
  {
    id: '5',
    text: '公園の設備情報',
    type: 'category',
    metadata: { category: 'facilities' }
  },
  {
    id: '6',
    text: '今月のイベント情報',
    type: 'recent',
    metadata: { category: 'events' }
  }
];

export function SearchSuggestions({
  query,
  onSuggestionSelect,
  onQueryChange,
  className = '',
  placeholder = '質問を入力してください...',
  disabled = false
}: SearchSuggestionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredSuggestions, setFilteredSuggestions] = useState<SearchSuggestion[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Filter suggestions based on query
  useEffect(() => {
    if (query.length === 0) {
      setFilteredSuggestions(SAMPLE_SUGGESTIONS.slice(0, 6));
    } else {
      const filtered = SAMPLE_SUGGESTIONS.filter(suggestion =>
        suggestion.text.toLowerCase().includes(query.toLowerCase()) ||
        suggestion.metadata?.category?.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6);
      setFilteredSuggestions(filtered);
    }
    setSelectedIndex(-1);
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredSuggestions.length) {
          onSuggestionSelect(filteredSuggestions[selectedIndex].text);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  // Scroll selected suggestion into view
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionRefs.current[selectedIndex]) {
      suggestionRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  const getSuggestionIcon = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'recent':
        return <Clock className="w-4 h-4 text-blue-500" />;
      case 'location':
        return <MapPin className="w-4 h-4 text-green-500" />;
      case 'category':
        return <Tag className="w-4 h-4 text-purple-500" />;
      case 'popular':
      default:
        return <Search className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSuggestionLabel = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'recent':
        return '最近の検索';
      case 'location':
        return '位置情報';
      case 'category':
        return 'カテゴリ';
      case 'popular':
        return '人気の質問';
      default:
        return '';
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => {
            // Delay closing to allow click on suggestions
            setTimeout(() => setIsOpen(false), 150);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full pl-10 pr-4 py-3 
            border border-gray-200 dark:border-gray-700 
            rounded-xl
            bg-white dark:bg-gray-800
            text-gray-900 dark:text-gray-100
            placeholder-gray-500 dark:placeholder-gray-400
            focus:ring-2 focus:ring-blue-500 focus:border-transparent
            transition-all duration-200
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          aria-label="検索クエリ入力"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          role="combobox"
        />
      </div>

      {/* Suggestions Dropdown */}
      {isOpen && filteredSuggestions.length > 0 && (
        <div 
          className="
            absolute top-full left-0 right-0 mt-2 
            bg-white dark:bg-gray-800 
            border border-gray-200 dark:border-gray-700 
            rounded-xl shadow-lg 
            max-h-96 overflow-y-auto 
            z-50
          "
          role="listbox"
        >
          {/* Header */}
          <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {query ? '検索候補' : 'おすすめの質問'}
            </span>
          </div>

          {/* Suggestions List */}
          <div className="py-2">
            {filteredSuggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                ref={(el) => (suggestionRefs.current[index] = el)}
                className={`
                  px-4 py-3 cursor-pointer transition-colors duration-150
                  hover:bg-gray-50 dark:hover:bg-gray-700
                  ${selectedIndex === index 
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-blue-500' 
                    : ''
                  }
                `}
                onClick={() => {
                  onSuggestionSelect(suggestion.text);
                  setIsOpen(false);
                }}
                role="option"
                aria-selected={selectedIndex === index}
              >
                <div className="flex items-center space-x-3">
                  {getSuggestionIcon(suggestion.type)}
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {suggestion.text}
                    </div>
                    
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {getSuggestionLabel(suggestion.type)}
                      </span>
                      
                      {suggestion.metadata?.frequency && (
                        <span className="text-xs text-blue-600 dark:text-blue-400">
                          {suggestion.metadata.frequency}%の人が検索
                        </span>
                      )}
                      
                      {suggestion.metadata?.category && (
                        <span className="
                          text-xs px-2 py-0.5 rounded-full
                          bg-gray-100 dark:bg-gray-700
                          text-gray-600 dark:text-gray-300
                        ">
                          {suggestion.metadata.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              ↑↓ で選択、Enter で確定、Esc でキャンセル
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchSuggestions;