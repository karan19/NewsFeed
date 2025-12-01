'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  StickyNote, 
  Lightbulb, 
  Briefcase, 
  Link2, 
  MessageSquare, 
  Bot, 
  Calendar,
  ArrowRight,
  Maximize2,
  Clock,
  KanbanSquare
} from 'lucide-react';

// Types
type RecordType = 'note' | 'thought' | 'contact' | 'project' | 'capture' | 'workboard' | 'llm-conversation' | 'mcp-conversation';

interface UnifiedRecord {
  PK: string;
  source_type: string;
  record_type: string;
  content: any; // Using any to be flexible with the dynamic content structure
  created_at: string;
}

interface FeedItemData {
  id: string;
  source_type: string;
  record_type: string; // broadened from RecordType to string to accept backend types
  title: string | null;
  content: string;
  created_at: string;
}

// Configuration
const SOURCE_CONFIG: Record<string, { icon: any, color: string, label: string }> = {
  notes: { icon: StickyNote, color: 'text-yellow-400', label: 'Note' },
  thoughts: { icon: Lightbulb, color: 'text-purple-400', label: 'Thought' },
  contacts: { icon: MessageSquare, color: 'text-green-400', label: 'Contact' },
  projects: { icon: Briefcase, color: 'text-blue-400', label: 'Project' },
  capture: { icon: Link2, color: 'text-pink-400', label: 'Capture' },
  'llm-council': { icon: Bot, color: 'text-orange-400', label: 'AI Chat' },
  workboard: { icon: KanbanSquare, color: 'text-cyan-400', label: 'Task' },
  default: { icon: Calendar, color: 'text-gray-400', label: 'Item' }
};

// Utils
function getSourceConfig(type: string) {
  return SOURCE_CONFIG[type] || SOURCE_CONFIG.default;
}

function formatDate(dateString: string) {
  try {
    if (!dateString) return '';
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
  } catch (e) {
    console.warn(`Invalid date: ${dateString}`, e);
    return '';
  }
}

function mapRecordToFeedItem(record: UnifiedRecord): FeedItemData {
  const contentObj = record.content || {};
  
  // Extract content based on record type or common fields
  let content = '';
  let title = contentObj.title || contentObj.contactName || null; // contactName for contacts

  if (typeof contentObj.content === 'string') {
    content = contentObj.content;
  } else if (contentObj.description) {
    content = contentObj.description;
  } else if (record.source_type === 'contacts') {
     content = `${contentObj.role || ''} ${contentObj.workingStyle ? `• ${contentObj.workingStyle}` : ''}`;
  } else {
    // Fallback for unknown structures
    content = JSON.stringify(contentObj);
  }

  // Ensure record type is a string
  const recordType = typeof record.record_type === 'string' ? record.record_type.toLowerCase() : 'unknown';

  return {
    id: record.PK,
    source_type: record.source_type,
    record_type: recordType,
    title,
    content,
    created_at: record.created_at,
  };
}

// Components
function BentoGrid({ items }: { items: FeedItemData[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-neutral-500">
        <p>No items found in your feed.</p>
        <p className="text-sm mt-2">Try running the backfill script to populate data.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[180px] grid-flow-dense pb-20">
      {items.map((item) => {
        const length = item.content?.length || 0;
        const hasTitle = !!item.title;
        const isList = item.content?.includes('\n');
        
        // Smart Sizing Algorithm
        let colSpan = 'col-span-1';
        let rowSpan = 'row-span-1';
        
        if (length > 300 && hasTitle) {
          // BIG: Long content with title
          colSpan = 'col-span-1 md:col-span-2';
          rowSpan = 'row-span-2';
        } else if (length > 100 && hasTitle && !isList) {
          // WIDE: Medium content with title (not a list)
          colSpan = 'col-span-1 md:col-span-2';
          rowSpan = 'row-span-1';
        } else if ((length > 150 && !hasTitle) || isList) {
          // TALL: Long thoughts OR Lists
          colSpan = 'col-span-1';
          rowSpan = 'row-span-2';
        }
        
        const config = getSourceConfig(item.source_type);
        const Icon = config.icon;
        
        // Visual styles
        const isBig = rowSpan === 'row-span-2' && colSpan.includes('col-span-2');
        const isTall = rowSpan === 'row-span-2' && !isBig;
        const isWide = colSpan.includes('col-span-2') && !isBig;
        const isQuote = item.record_type === 'thought' && !hasTitle;
        
        return (
          <div 
            key={item.id} 
            className={`
              ${colSpan} ${rowSpan}
              group relative flex flex-col justify-between
              rounded-xl border border-neutral-800 bg-neutral-900/40 p-5 
              hover:border-neutral-700 hover:bg-neutral-900/80 transition-all cursor-pointer overflow-hidden
              ${isQuote ? 'justify-center items-center text-center bg-gradient-to-br from-neutral-900/80 to-purple-900/10' : ''}
            `}
          >
             {/* Header */}
             <div className={`flex items-center justify-between w-full mb-3 ${isQuote ? 'absolute top-4 right-4 w-auto mb-0' : ''}`}>
               <div className={`flex items-center gap-2 ${isQuote ? 'hidden' : ''}`}>
                 <div className={`p-1 rounded-md bg-neutral-950/50 ${config.color}`}>
                    <Icon size={12} />
                 </div>
                 <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">{config.label}</span>
               </div>
               {isBig && <Maximize2 size={14} className="text-neutral-600 opacity-0 group-hover:opacity-100 transition-opacity" />}
             </div>
             
             {/* Content */}
             <div className="flex-1 min-h-0 overflow-hidden relative">
               {hasTitle && (
                 <h3 className={`font-bold text-neutral-200 mb-2 leading-tight ${isBig ? 'text-2xl' : 'text-lg'}`}>
                   {item.title}
                 </h3>
               )}
               
               <div className={`
                 text-neutral-400 leading-relaxed whitespace-pre-line
                 ${isQuote ? 'text-xl font-serif italic text-neutral-300' : 'text-sm'}
                 ${isBig ? 'line-clamp-6' : isTall ? 'line-clamp-[8]' : 'line-clamp-3'}
               `}>
                 {item.content}
               </div>
               
               {/* Fade out for truncated content */}
               {(isBig || isTall || isWide) && <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-neutral-900/90 to-transparent" />}
             </div>
             
             {/* Footer */}
             <div className={`mt-4 pt-4 border-t border-neutral-800/50 flex items-center justify-between text-xs text-neutral-600 ${isQuote ? 'hidden' : ''}`}>
                <div className="flex items-center gap-1">
                  <Clock size={12} />
                  <span>{formatDate(item.created_at)}</span>
                </div>
                {(isBig || isTall || isWide) && <span className="text-blue-400/80 group-hover:text-blue-400 flex items-center gap-1">Read <ArrowRight size={10} /></span>}
             </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FeedPage() {
  const { user, isLoading: authLoading, isAuthenticated, logout, getAccessToken } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<FeedItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  useEffect(() => {
    async function fetchFeed() {
      if (!isAuthenticated) return;
      
      try {
        setLoading(true);
        const apiUrl = process.env.NEXT_PUBLIC_NEWSFEED_API_URL;
        
        if (!apiUrl) {
          console.warn('NEXT_PUBLIC_NEWSFEED_API_URL not set, using placeholder data');
          setLoading(false);
          return;
        }

        // TODO: Add Authorization header once API Gateway is secured
        // const token = await getAccessToken();
        
        const response = await fetch(`${apiUrl}/feed?limit=50`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch feed');
        }

        const data = await response.json();
        const mappedItems = data.items.map(mapRecordToFeedItem);
        setItems(mappedItems);
      } catch (err) {
        console.error('Error fetching feed:', err);
        setError('Failed to load feed');
      } finally {
        setLoading(false);
      }
    }

    fetchFeed();
  }, [isAuthenticated, getAccessToken]);

  if (authLoading) return null;
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-black text-neutral-200 selection:bg-neutral-800 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-neutral-800 flex-shrink-0">
        <div className="w-full max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
               <span className="text-black font-bold text-lg">N</span>
            </div>
            <span className="font-semibold text-white tracking-tight hidden sm:inline-block">NewsFeed</span>
          </div>

          <div className="flex items-center gap-3">
             <div className="hidden md:flex items-center gap-4 text-xs font-medium text-neutral-500 mr-4">
                <span>{items.length} items</span>
                <span>{loading ? 'Updating...' : 'Live'}</span>
             </div>
             <Button variant="ghost" size="sm" onClick={logout} className="text-neutral-500 hover:text-white h-8 w-8 p-0 rounded-full">
               <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white">
                 {user?.username?.[0]?.toUpperCase()}
               </div>
             </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto w-full px-4 py-8">
        {error && (
          <div className="mb-8 p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        
        {loading && items.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
          </div>
        ) : (
          <BentoGrid items={items} />
        )}
        
        {/* Load More Button - Only show if we have items */}
        {items.length > 0 && (
          <div className="flex justify-center mt-8">
            <Button variant="outline" className="border-neutral-800 text-neutral-400 hover:text-white bg-neutral-900/50">Load more items</Button>
          </div>
        )}
      </main>
    </div>
  );
}
