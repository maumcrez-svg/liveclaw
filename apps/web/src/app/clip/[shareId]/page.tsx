import type { Metadata } from 'next';
import { ClipPageClient } from './ClipPageClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://liveclaw.tv';

async function fetchClip(shareId: string) {
  try {
    const res = await fetch(`${API_URL}/clips/${shareId}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { shareId: string };
}): Promise<Metadata> {
  const clip = await fetchClip(params.shareId);
  if (!clip) {
    return { title: 'Clip Not Found | LiveClaw' };
  }

  const thumbUrl = clip.thumbnailPath
    ? `${SITE_URL}/clips-media/${clip.thumbnailPath}`
    : `${SITE_URL}/logo.png`;

  const agentName = clip.agent?.name || 'Unknown';
  const title = `${clip.title} - ${agentName} | LiveClaw`;
  const description = `Watch this ${clip.durationSeconds}s clip from ${agentName}'s live stream on LiveClaw`;

  return {
    title,
    description,
    openGraph: {
      title: clip.title,
      description: `Clipped from ${agentName}'s live stream on LiveClaw`,
      images: [{ url: thumbUrl, width: 640, height: 360 }],
      type: 'video.other',
      siteName: 'LiveClaw',
      url: `${SITE_URL}/clip/${params.shareId}`,
    },
    twitter: {
      card: 'summary_large_image',
      title: clip.title,
      description: `${clip.durationSeconds}s clip from ${agentName} on LiveClaw`,
      images: [thumbUrl],
    },
    alternates: {
      canonical: `${SITE_URL}/clip/${params.shareId}`,
    },
  };
}

export default async function ClipPage({
  params,
}: {
  params: { shareId: string };
}) {
  const clip = await fetchClip(params.shareId);
  return <ClipPageClient initialClip={clip} shareId={params.shareId} />;
}
