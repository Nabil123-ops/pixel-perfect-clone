import { useState } from "react";
import {
  Play,
  Clock,
  Globe,
  Code2,
  Pencil,
  GitBranch,
  Hourglass,
  Sigma,
  Webhook,
  Filter,
  Merge,
  ArrowDownUp,
  ListFilter,
  Rows3,
  CopyMinus,
  Hash,
  MessageSquare,
  Send,
  Sparkles,
  Brain,
  Bot,
  Scan,
  Tags,
  Calculator,
  Workflow,
  Database,
  FileSpreadsheet,
  FileText,
  FileArchive,
  Image as ImageIcon,
  Binary,
  Table,
  Braces,
  Shuffle,
  Type,
  KeyRound,
  ListTree,
  Repeat,
  ShieldCheck,
  Boxes,
  Search,
  BookOpen,
  Terminal,
  Layers,
  Mail,
  CalendarDays,
  QrCode,
  Languages,
  CircleDollarSign,
  CloudSun,
  Link2,
  Barcode,
  Cpu,
  Network,
  Split,
  MemoryStick,
} from "lucide-react";

/** Lucide icons for engine/core nodes that have no brand logo. */
const LUCIDE: Record<string, typeof Play> = {
  play: Play,
  clock: Clock,
  globe: Globe,
  code: Code2,
  pencil: Pencil,
  split: GitBranch,
  switch: Split,
  hourglass: Hourglass,
  sigma: Sigma,
  webhook: Webhook,
  filter: Filter,
  merge: Merge,
  sort: ArrowDownUp,
  limit: ListFilter,
  "split-out": Rows3,
  dedupe: CopyMinus,
  hash: Hash,
  chat: MessageSquare,
  send: Send,
  sparkles: Sparkles,
  brain: Brain,
  bot: Bot,
  scan: Scan,
  tags: Tags,
  calculator: Calculator,
  workflow: Workflow,
  database: Database,
  memory: MemoryStick,
  spreadsheet: FileSpreadsheet,
  file: FileText,
  archive: FileArchive,
  image: ImageIcon,
  binary: Binary,
  table: Table,
  braces: Braces,
  shuffle: Shuffle,
  type: Type,
  key: KeyRound,
  tree: ListTree,
  repeat: Repeat,
  shield: ShieldCheck,
  boxes: Boxes,
  search: Search,
  book: BookOpen,
  terminal: Terminal,
  layers: Layers,
  mail: Mail,
  calendar: CalendarDays,
  qr: QrCode,
  translate: Languages,
  currency: CircleDollarSign,
  weather: CloudSun,
  link: Link2,
  barcode: Barcode,
  cpu: Cpu,
  network: Network,
  vector: Network,
};

/**
 * Renders the real brand logo for integration nodes (Simple Icons CDN, keyed by
 * brand slug) and a Lucide glyph for engine nodes. Falls back to a globe when a
 * brand slug has no logo so a node never renders blank.
 */
export function NodeIcon({ icon, className = "size-4" }: { icon: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const Lucide = LUCIDE[icon];
  if (Lucide) return <Lucide className={className} />;
  if (failed) return <Globe className={className} />;
  return (
    <img
      src={`https://cdn.simpleicons.org/${icon}`}
      alt=""
      aria-hidden="true"
      loading="lazy"
      className={`${className} object-contain`}
      onError={() => setFailed(true)}
    />
  );
}
