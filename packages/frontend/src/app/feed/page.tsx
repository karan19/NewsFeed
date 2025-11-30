'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
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

interface FeedItemData {
  id: string;
  source_type: string;
  record_type: RecordType;
  title: string | null;
  content: string;
  created_at: string;
}

// Extended Placeholder Data for Dense Grid Demo
const PLACEHOLDER_ITEMS: FeedItemData[] = [
  // BIG (2x2)
  {
    id: '1',
    source_type: 'projects',
    record_type: 'project',
    title: 'Q1 Roadmap Planning',
    content: 'Discussed project roadmap and next steps for Q1. Key priorities: finish the data pipeline, build the search feature, and launch the mobile app. We need to allocate resources for the backend migration and ensure we have enough coverage for the new features. The mobile app should support offline mode and sync when online. We also discussed the need for a design system update to unify the web and mobile experiences. The timeline is tight, but if we parallelize the backend and frontend work, we might make the March deadline.',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  // SMALL (1x1)
  {
    id: '2',
    source_type: 'thoughts',
    record_type: 'thought',
    title: null,
    content: 'Simplicity is the ultimate sophistication.', 
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  // WIDE (2x1)
  {
    id: '3',
    source_type: 'capture',
    record_type: 'capture',
    title: 'The Future of PKM',
    content: 'Key insight: tools matter less than habits. The PARA method suggests organizing by Projects, Areas, Resources, and Archives. This flat hierarchy keeps things actionable.',
    created_at: new Date(Date.now() - 86400000 * 1.5).toISOString(),
  },
  // SMALL (1x1)
  {
    id: '4',
    source_type: 'notes',
    record_type: 'note',
    title: 'Grocery List',
    content: 'Milk, Eggs, Bread, Coffee beans, Avocados.',
    created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  // TALL (1x2) - List style
  {
    id: '5',
    source_type: 'workboard',
    record_type: 'workboard',
    title: 'Sprint Tasks',
    content: '1. Fix login bug\n2. Update API docs\n3. Review PR #42\n4. Deploy to staging\n5. Run integration tests\n6. Email stakeholders\n7. Update Jira tickets\n8. Plan next sprint retro',
    created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  // SMALL (1x1)
  {
    id: '6',
    source_type: 'thoughts',
    record_type: 'thought',
    title: null,
    content: 'Embeddings > Keywords. Semantic search is the future.',
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  // WIDE (2x1)
  {
    id: '7',
    source_type: 'projects',
    record_type: 'project',
    title: 'Mobile App MVP',
    content: 'Starting work on the mobile companion app. Phase 1 is read-only feed. Phase 2 adds capture. Phase 3 adds offline sync. Using React Native for cross-platform support.',
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  // SMALL (1x1)
  {
    id: '8',
    source_type: 'llm-council',
    record_type: 'llm-conversation',
    title: 'Architecture Review',
    content: 'DynamoDB Streams vs EventBridge: Streams chosen for ordering guarantees.',
    created_at: new Date(Date.now() - 86400000 * 6).toISOString(),
  },
  // SMALL (1x1)
  {
    id: '9',
    source_type: 'contacts',
    record_type: 'contact',
    title: 'Coffee with Sarah',
    content: 'Discussed AI trends and new startup ideas.',
    created_at: new Date(Date.now() - 86400000 * 7).toISOString(),
  },
  // BIG (2x2)
  {
    id: '10',
    source_type: 'capture',
    record_type: 'capture',
    title: 'System Design: NewsFeed',
    content: 'The core challenge is consolidating heterogeneous data schemas. We decided on a "Unified Record" pattern where every source item is transformed into a standard JSON structure. The Partition Key is the TABLE_NAME and the Sort Key is the RECORD_ID. This allows us to query by source easily. Global Secondary Indexes (GSIs) are used for querying by date across all sources, effectively creating a time-series view of personal data.',
    created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
  },
  // SMALL (1x1)
  {
    id: '11',
    source_type: 'thoughts',
    record_type: 'thought',
    title: null,
    content: 'Design is intelligence made visible.',
    created_at: new Date(Date.now() - 86400000 * 9).toISOString(),
  },
  // TALL (1x2)
  {
    id: '12',
    source_type: 'notes',
    record_type: 'note',
    title: 'Books to Read',
    content: '- The Design of Everyday Things\n- Clean Code\n- Zero to One\n- Atomic Habits\n- Deep Work\n- Thinking, Fast and Slow\n- The Pragmatic Programmer',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  // SMALL (1x1)
  {
    id: '13',
    source_type: 'workboard',
    record_type: 'workboard',
    title: 'Backend Refactor',
    content: 'Migrate to monorepo structure complete.',
    created_at: new Date(Date.now() - 86400000 * 11).toISOString(),
  },
  // WIDE (2x1)
  {
    id: '14',
    source_type: 'projects',
    record_type: 'project',
    title: 'Search Service',
    content: 'Implementing OpenSearch for full-text capabilities. Need to set up the ingestion lambda to stream updates from the unified table to the search index.',
    created_at: new Date(Date.now() - 86400000 * 12).toISOString(),
  },
  // SMALL (1x1)
  {
    id: '15',
    source_type: 'thoughts',
    record_type: 'thought',
    title: null,
    content: 'Constraint breeds creativity.',
    created_at: new Date(Date.now() - 86400000 * 13).toISOString(),
  }
];

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
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

// Components
function BentoGrid({ items }: { items: FeedItemData[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[180px] grid-flow-dense pb-20">
      {items.map((item) => {
        const length = item.content.length;
        const hasTitle = !!item.title;
        const isList = item.content.includes('\n');
        
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
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) return null;
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
                <span>{PLACEHOLDER_ITEMS.length} items</span>
                <span>Last updated just now</span>
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
        <BentoGrid items={PLACEHOLDER_ITEMS} />
        
        {/* Load More Button */}
        <div className="flex justify-center">
          <Button variant="outline" className="border-neutral-800 text-neutral-400 hover:text-white bg-neutral-900/50">Load more items</Button>
        </div>
      </main>
    </div>
  );
}
