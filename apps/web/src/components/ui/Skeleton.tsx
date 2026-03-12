// Base skeleton element with animate-pulse
export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded bg-claw-card ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// Mimics StreamCard: thumbnail + text lines
export function StreamCardSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true" aria-label="Loading stream">
      <Skeleton className="w-full aspect-video rounded-lg" />
      <div className="flex gap-2 px-1">
        <Skeleton className="w-8 h-8 rounded-full flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2 py-0.5">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
    </div>
  );
}

// Chat message bubbles placeholder
export function ChatSkeleton() {
  const widths = [80, 55, 70, 45, 65, 50, 75];
  return (
    <div className="p-3 space-y-3" aria-busy="true" aria-label="Loading chat">
      {widths.map((width, i) => (
        <div key={i} className="flex items-start gap-2">
          <Skeleton className="w-5 h-3 rounded flex-shrink-0 mt-0.5" />
          <Skeleton className="h-3 rounded" style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
  );
}

// Full agent channel page skeleton: player + info + chat
export function AgentPageSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row h-full" aria-busy="true" aria-label="Loading channel">
      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Video player placeholder */}
        <Skeleton className="w-full aspect-video rounded-none" />

        {/* Channel header */}
        <div className="p-4 border-b border-claw-border space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3.5 w-24" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded" />
              <Skeleton className="h-8 w-24 rounded" />
              <Skeleton className="h-8 w-20 rounded" />
            </div>
          </div>
        </div>

        {/* Tabs placeholder */}
        <div className="p-4 space-y-3">
          <div className="flex gap-4 border-b border-claw-border pb-3">
            <Skeleton className="h-4 w-14" />
            <Skeleton className="h-4 w-14" />
          </div>
          <div className="space-y-2 pt-1">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-5/6" />
            <Skeleton className="h-3.5 w-4/6" />
          </div>
        </div>
      </div>

      {/* Chat column */}
      <div className="hidden lg:flex w-[340px] border-l border-claw-border flex-col flex-shrink-0">
        <div className="p-3 border-b border-claw-border flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3.5 w-16" />
        </div>
        <ChatSkeleton />
      </div>
    </div>
  );
}

// Dashboard card: avatar + text lines
export function DashboardCardSkeleton() {
  return (
    <div
      className="bg-claw-card border border-claw-border rounded-lg p-4 flex gap-3 items-start"
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2 py-0.5">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
