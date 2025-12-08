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
  X,
  Archive,
  Database,
  Mic,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { ThemeToggle } from '@/components/theme-toggle';

// Types
type RecordType = 'note' | 'thought' | 'contact' | 'project' | 'capture' | 'workboard' | 'llm-conversation' | 'mcp-conversation';

interface UnifiedRecord {
  PK: string;
  source_type: string;
  record_type: string;
  table_name: string;
  content: any; // Using any to be flexible with the dynamic content structure
  created_at: string;
  ai_summary?: string;
  ai_insight?: string;
}

interface FeedItemData {
  id: string;
  source_type: string;
  record_type: string; // broadened from RecordType to string to accept backend types
  table_name: string;
  title: string | null;
  content: string;
  created_at: string;
  aiSummary?: string;
  aiInsight?: string;
}

// Configuration
// Using null for default icon as requested
const SOURCE_CONFIG: Record<string, { icon: any, color: string, label: string }> = {
  notes: { icon: StickyNote, color: 'text-yellow-400', label: 'Note' },
  thoughts: { icon: Lightbulb, color: 'text-purple-400', label: 'Thought' },
  contacts: { icon: MessageSquare, color: 'text-green-400', label: 'Contact' },
  projects: { icon: Briefcase, color: 'text-blue-400', label: 'Project' },
  capture: { icon: Link2, color: 'text-pink-400', label: 'Capture' },
  'llm-council': { icon: Bot, color: 'text-orange-400', label: 'AI Chat' },
  soliloquies: { icon: Mic, color: 'text-red-400', label: 'Voice Note' },
  default: { icon: null, color: 'text-gray-400', label: '' }
};

const TABLE_MAPPING: Record<string, string> = {
  'nexusnote-notes-production': 'Notes',
  'nexusnote-thoughts-production': 'Thoughts',
  'nexusnote-inno-contacts-production': 'Contacts',
  'nexusnote-implementation-projects-production': 'Projects',
  'Capture': 'Capture',
  'LLMCouncilConversations': 'LLM Council',
  'nexusnote-soliloquies-production': 'Soliloquies',
};

function getFriendlyTableName(tableName: string) {
  return TABLE_MAPPING[tableName] || tableName;
}

// Color Palettes for Cards
// Only keeping the smart palette as it handles both themes
const SMART_PALETTE = [
  'bg-zinc-100 dark:bg-slate-900/50 border-zinc-200 dark:border-slate-800',
  'bg-blue-100 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50',
  'bg-emerald-100 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50',
  'bg-violet-100 dark:bg-violet-950/30 border-violet-200 dark:border-violet-900/50',
  'bg-orange-100 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/50',
  'bg-rose-100 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50',
  'bg-cyan-100 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-900/50',
  'bg-amber-100 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50',
  'bg-fuchsia-100 dark:bg-fuchsia-950/30 border-fuchsia-200 dark:border-fuchsia-900/50',
];

// Utils
function getSourceConfig(type: string) {
  return SOURCE_CONFIG[type] || SOURCE_CONFIG.default;
}

function getCardColor(id: string) {
  // Always use the smart palette
  const colors = SMART_PALETTE;
  // Deterministic color based on ID hash
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
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
  const c = record.content || {};

  // 1. Resolve Title
  // Priority: semantic keys > generic keys
  const title = c.noteTitle ||
    c.projectTitle ||
    c.contactName ||
    c.captureTitle ||
    c.conversationTitle ||
    c.title ||
    null;

  // 2. Resolve Content
  let content = '';

  // Notes
  if (c.noteContent) {
    content = c.noteContent;
  }
  // Thoughts
  else if (c.thoughtContent) {
    content = c.thoughtContent;
  }
  // Projects
  else if (c.projectDescription) {
    content = c.projectDescription;
  }
  // Capture
  else if (c.captureContent) {
    content = c.captureContent;
  }
  // Soliloquies
  else if (c.voiceNoteTranscript) {
    content = c.voiceNoteTranscript;
  }
  // Contacts (Semantic)
  else if (c.contactRole || c.contactWorkingStyle) {
    content = `${c.contactRole || ''} ${c.contactWorkingStyle ? `• ${c.contactWorkingStyle}` : ''}`.trim();
  }
  // Contacts (Legacy/Fallback)
  else if (record.source_type === 'contacts' && (c.role || c.workingStyle)) {
    content = `${c.role || ''} ${c.workingStyle ? `• ${c.workingStyle}` : ''}`.trim();
  }
  // LLM Council
  else if (record.record_type === 'LLM_CONVERSATION') {
    const query = c.userQuery;
    const response = c.councilResponse;
    if (query && response) {
      content = `Q: ${query}\n\nA: ${response}`;
    } else {
      content = query || response || JSON.stringify(c);
    }
  }
  // Generic / Legacy Fallbacks
  else if (typeof c.content === 'string') {
    content = c.content;
  } else if (c.description) {
    content = c.description;
  } else {
    // Fallback for unknown structures
    content = JSON.stringify(c);
  }

  // Ensure record type is a string
  const recordType = typeof record.record_type === 'string' ? record.record_type.toLowerCase() : 'unknown';

  return {
    id: record.PK,
    source_type: record.source_type,
    record_type: recordType,
    table_name: record.table_name || '',
    title,
    content,
    created_at: record.created_at,
    aiSummary: record.ai_summary,
    aiInsight: record.ai_insight,
  };
}

// Components
const FeedCard = ({ item, onArchive, onExpand }: { item: FeedItemData, onArchive: (id: string) => void, onExpand: (id: string) => void }) => {
  const [isFlipped, setIsFlipped] = useState(false);

  const length = item.content?.length || 0;
  const hasTitle = !!item.title;
  const isList = item.content?.includes('\n');

  // Smart Sizing Algorithm
  let colSpan = 'col-span-1';
  let rowSpan = 'row-span-1';

  if (length > 300 && hasTitle) {
    colSpan = 'col-span-1 md:col-span-2';
    rowSpan = 'row-span-2';
  } else if (length > 100 && hasTitle && !isList) {
    colSpan = 'col-span-1 md:col-span-2';
    rowSpan = 'row-span-1';
  } else if ((length > 150 && !hasTitle) || isList) {
    colSpan = 'col-span-1';
    rowSpan = 'row-span-2';
  }

  const config = getSourceConfig(item.source_type);
  const Icon = config.icon;

  const isBig = rowSpan === 'row-span-2' && colSpan.includes('col-span-2');
  const isTall = rowSpan === 'row-span-2' && !isBig;
  const isQuote = item.record_type === 'thought' && !hasTitle;
  const cardColor = isQuote
    ? 'bg-gradient-to-br from-primary/5 to-purple-500/10 border-border'
    : getCardColor(item.id);

  // Content to display
  const frontContent = item.aiSummary || item.content;
  const backContent = item.aiInsight || "No AI insight available for this item.";

  return (
    <div className={`${colSpan} ${rowSpan} group relative perspective-1000`}>
      <motion.div
        className={`relative w-full h-full duration-500 preserve-3d cursor-pointer`}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        {/* FRONT SIDE */}
        <div className={`
            absolute inset-0 backface-hidden flex flex-col justify-between
            rounded-xl border p-5 
            ${cardColor}
            hover:border-primary/50 text-left
            ${isQuote ? 'justify-center items-center text-center' : ''}
            shadow-sm
          `}>

          {/* Header */}
          <div className={`flex items-center justify-between w-full mb-3 ${isQuote ? 'absolute top-4 right-4 w-auto mb-0' : ''}`}>
            <div className={`flex items-center gap-2 ${isQuote ? 'hidden' : ''}`}>
              {Icon && (
                <div className={`p-1 rounded-md bg-muted ${config.color}`}>
                  <Icon size={12} />
                </div>
              )}
              <div className="flex flex-col">
                {config.label && <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground leading-none">{config.label}</span>}
                {item.table_name && (
                  <span className="text-[9px] text-muted-foreground/70 truncate max-w-[100px] leading-tight mt-0.5">
                    {getFriendlyTableName(item.table_name)}
                  </span>
                )}
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2">
              {item.aiSummary && <div className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded">AI</div>}
              <button
                className="text-muted-foreground hover:text-primary transition-all p-1.5 rounded-md hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  onExpand(item.id);
                }}
                title="Expand"
              >
                <Maximize2 size={16} />
              </button>
              <button
                className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-all p-1 rounded-md hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive(item.id);
                }}
                title="Archive"
              >
                <Archive size={14} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-hidden relative">
            {hasTitle && (
              <h3 className={`font-bold text-foreground mb-2 leading-tight ${isBig ? 'text-2xl' : 'text-lg'}`}>
                {item.title}
              </h3>
            )}

            <div className={`
               text-muted-foreground leading-relaxed whitespace-pre-line
               ${isQuote ? 'text-xl font-serif italic text-foreground/80' : 'text-sm'}
               ${isBig ? 'line-clamp-6' : isTall ? 'line-clamp-[8]' : 'line-clamp-3'}
             `}>
              {frontContent}
            </div>
          </div>

          {/* Footer */}
          <div className={`mt-4 pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground ${isQuote ? 'hidden' : ''}`}>
            <div className="flex items-center gap-1">
              <Clock size={12} />
              <span>{formatDate(item.created_at)}</span>
            </div>
            <span className="text-primary/60 group-hover:text-primary flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider">
              Flip for Insight <ArrowRight size={10} />
            </span>
          </div>
        </div>

        {/* BACK SIDE */}
        <div className={`
            absolute inset-0 backface-hidden rotate-y-180 flex flex-col
            rounded-xl border p-6
            bg-zinc-900 border-indigo-500/30 text-white
            shadow-xl overflow-y-auto custom-scrollbar
          `}
          style={{ transform: "rotateY(180deg)" }}
        >
          <div className="flex items-center gap-2 mb-4 text-indigo-400">
            <Bot size={16} />
            <span className="text-xs font-bold uppercase tracking-wider">AI Insight</span>
          </div>

          <div className="prose prose-invert prose-sm leading-relaxed">
            <p className="whitespace-pre-line font-medium text-indigo-50">
              {backContent}
            </p>
          </div>

          <div className="mt-auto pt-4 flex justify-end">
            <span className="text-[10px] uppercase tracking-widest text-zinc-500">Tap to flip back</span>
          </div>
        </div>

      </motion.div>
    </div>
  );
}

// Expanded Modal with Tab Toggle (no 3D flip for scroll compatibility)
const ExpandedModal = ({ item, onClose }: { item: FeedItemData, onClose: () => void }) => {
  const [showInsight, setShowInsight] = useState(false);

  const config = getSourceConfig(item.source_type);
  const ModalIcon = config.icon;

  // Lock body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 pointer-events-none">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className={`w-full max-w-4xl h-[80vh] pointer-events-auto rounded-2xl shadow-2xl flex flex-col border ${showInsight ? 'bg-zinc-900 border-indigo-500/30' : `${getCardColor(item.id)} bg-card`}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              {showInsight ? (
                <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                  <Lightbulb size={20} />
                </div>
              ) : (
                ModalIcon && (
                  <div className={`p-2 rounded-lg bg-muted ${config.color}`}>
                    <ModalIcon size={20} />
                  </div>
                )
              )}
              <div>
                <span className={`text-sm font-bold uppercase tracking-wider block ${showInsight ? 'text-indigo-400' : 'text-muted-foreground'}`}>
                  {showInsight ? 'AI Insight' : config.label}
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {item.table_name && (
                    <span className="flex items-center gap-1">
                      <Database size={10} />
                      {getFriendlyTableName(item.table_name)}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {formatDate(item.created_at)}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-muted hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {item.title && (
              <h2 className={`text-xl font-bold mb-4 leading-tight ${showInsight ? 'text-white' : 'text-foreground'}`}>
                {item.title}
              </h2>
            )}

            <AnimatePresence mode="wait">
              {showInsight ? (
                <motion.div
                  key="insight"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="p-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20"
                >
                  <p className="text-indigo-50 leading-relaxed text-sm font-medium">
                    {item.aiInsight || "No AI insight available for this item."}
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="summary"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  {/* AI Summary Section */}
                  <div className="mb-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2 mb-3 text-primary">
                      <Bot size={14} />
                      <span className="text-xs font-bold uppercase tracking-wider">AI Summary</span>
                    </div>
                    <p className="text-foreground/90 leading-relaxed text-sm">
                      {item.aiSummary || item.content}
                    </p>
                  </div>

                  {/* Original Content */}
                  <div className="prose prose-invert dark:prose-invert prose-neutral max-w-none text-foreground/70">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Original Content</h4>
                    <p className="whitespace-pre-line leading-relaxed text-sm">
                      {item.content}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Toggle Button Footer */}
          <div className={`p-4 border-t shrink-0 ${showInsight ? 'border-zinc-800 bg-zinc-950/50' : 'border-border bg-muted/30'}`}>
            <button
              onClick={() => setShowInsight(!showInsight)}
              className={`w-full py-3 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${showInsight
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  : 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400'
                }`}
            >
              {showInsight ? (
                <>
                  <Bot size={18} />
                  View Summary
                  <ArrowRight size={16} className="rotate-180" />
                </>
              ) : (
                <>
                  <Lightbulb size={18} />
                  View AI Insight
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
};

function BentoGrid({ items, onArchive }: { items: FeedItemData[], onArchive: (id: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-neutral-500">
        <p>No items found in your feed.</p>
        <p className="text-sm mt-2">Try running the backfill script to populate data.</p>
      </div>
    );
  }

  const expandedItem = items.find(item => item.id === expandedId);

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 auto-rows-[180px] grid-flow-dense pb-20">
        {items.map((item) => (
          <FeedCard key={item.id} item={item} onArchive={onArchive} onExpand={setExpandedId} />
        ))}
      </div>

      {/* Expanded Modal View */}
      <AnimatePresence>
        {expandedId && expandedItem && (
          <ExpandedModal item={expandedItem} onClose={() => setExpandedId(null)} />
        )}
      </AnimatePresence>
    </>
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

        const userId = user?.userId;
        const queryParams = new URLSearchParams({ limit: '50' });
        if (userId) queryParams.append('userId', userId);

        const response = await fetch(`${apiUrl}/feed?${queryParams.toString()}`);

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

  const handleArchive = async (id: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_NEWSFEED_API_URL;
      if (!apiUrl) return;

      // Optimistic update: Remove from UI immediately
      setItems(current => current.filter(item => item.id !== id));

      // Call API
      // In a real app, you would also get the token for auth
      // const token = await getAccessToken(); 

      // Note: The path is /feed/{id}/archive
      const response = await fetch(`${apiUrl}/feed/${encodeURIComponent(id)}/archive`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_archived: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to archive item');
      }
    } catch (err) {
      console.error('Error archiving item:', err);
      // Revert optimistic update (fetch feed again or add item back if we kept reference)
      // For simplicity, we'll just show a toast/alert in a real app, here we just log
    }
  };

  if (authLoading) return null;
  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-neutral-200 dark:selection:bg-neutral-800 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border flex-shrink-0">
        <div className="w-full max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center">
              <span className="font-bold text-lg">N</span>
            </div>
            <span className="font-semibold tracking-tight hidden sm:inline-block">NewsFeed</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-4 text-xs font-medium text-muted-foreground mr-4">
              <span>{items.length} items</span>
              <span>{loading ? 'Updating...' : 'Live'}</span>
            </div>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground hover:text-foreground h-8 w-8 p-0 rounded-full">
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
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <BentoGrid items={items} onArchive={handleArchive} />
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
