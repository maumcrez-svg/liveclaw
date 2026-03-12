import Link from 'next/link';

interface CategoryCardProps {
  category: {
    slug: string;
    name: string;
    iconUrl?: string | null;
    imageUrl?: string | null;
    viewerCount?: number;
  };
}

export function CategoryCard({ category }: CategoryCardProps) {
  const viewers = category.viewerCount ?? 0;

  return (
    <Link
      href={`/browse/${category.slug}`}
      className="group focus-visible:ring-2 focus-visible:ring-claw-accent focus-visible:outline-none rounded-lg"
    >
      <div className="aspect-[2/3] rounded-lg overflow-hidden relative hover:scale-[1.03] hover:shadow-lg hover:shadow-black/20 transition-all duration-200">
        {category.imageUrl ? (
          <>
            <img
              src={category.imageUrl}
              alt={category.name}
              className="w-full h-full object-cover"
            />
            {/* The image already has the category name baked in, so just overlay viewer count */}
            {viewers > 0 && (
              <div className="absolute top-2 left-2">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-black/70 backdrop-blur-sm text-[10px] font-bold text-claw-live rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-claw-live" />
                  {viewers.toLocaleString()}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-claw-accent/30 to-claw-card flex flex-col items-center justify-center gap-2 border border-claw-border group-hover:border-claw-accent transition-colors">
            <span className="text-4xl font-bold text-claw-accent/60">
              {category.name[0]?.toUpperCase()}
            </span>
            <p className="text-sm font-semibold text-claw-text truncate px-2 text-center">
              {category.name}
            </p>
          </div>
        )}
      </div>
      {/* Name below card for clarity */}
      <p className="mt-1.5 text-sm font-semibold text-claw-text truncate group-hover:text-claw-accent transition-colors">
        {category.name}
      </p>
      {viewers > 0 && (
        <p className="text-[11px] text-claw-text-muted">
          {viewers.toLocaleString()} viewers
        </p>
      )}
    </Link>
  );
}
