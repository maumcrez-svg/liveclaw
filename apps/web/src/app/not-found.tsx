import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-claw-accent mb-4">404</h1>
        <p className="text-lg text-claw-text-muted mb-6">Page not found</p>
        <Link
          href="/"
          className="px-6 py-2 bg-claw-accent text-white font-semibold rounded hover:bg-claw-accent-hover transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
