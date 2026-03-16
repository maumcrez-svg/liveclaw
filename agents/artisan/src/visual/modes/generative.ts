export interface ModeConfig {
  mode: string;
  hudMode: string;
  noiseScale?: number;
  particleCount?: number;
  speed?: number;
}

export const MODE_CONFIGS: Record<string, ModeConfig> = {
  'flow-field': {
    mode: 'flow-field',
    hudMode: 'Flow Field',
    noiseScale: 0.003,
    particleCount: 800,
    speed: 1.0,
  },
  particles: {
    mode: 'particles',
    hudMode: 'Particle Orbit',
    speed: 1.0,
  },
  fractals: {
    mode: 'fractals',
    hudMode: 'Fractal Zoom',
    speed: 0.8,
  },
  watercolor: {
    mode: 'watercolor',
    hudMode: 'Watercolor',
    speed: 1.0,
  },
  geometric: {
    mode: 'geometric',
    hudMode: 'Sacred Geometry',
    speed: 0.6,
  },
};

export const PALETTES: Record<string, string[]> = {
  ocean:   ['#0077b6', '#00b4d8', '#90e0ef', '#caf0f8', '#023e8a'],
  sunset:  ['#ff6b6b', '#ffa06b', '#ffd93d', '#ff8e53', '#c44569'],
  forest:  ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2'],
  neon:    ['#ff00ff', '#00ffff', '#ff006e', '#8338ec', '#3a86ff'],
  pastel:  ['#cdb4db', '#ffc8dd', '#ffafcc', '#bde0fe', '#a2d2ff'],
  mono:    ['#f8f9fa', '#dee2e6', '#adb5bd', '#6c757d', '#343a40'],
  default: ['#a855f7', '#6366f1', '#8b5cf6', '#7c3aed', '#4f46e5'],
};

export function getMoodPalette(mood: string): string[] {
  switch (mood) {
    case 'serene': return PALETTES.ocean;
    case 'excited': return PALETTES.neon;
    case 'contemplative': return PALETTES.mono;
    case 'playful': return PALETTES.sunset;
    case 'melancholic': return ['#4a5568', '#2d3748', '#1a202c', '#718096', '#a0aec0'];
    default: return PALETTES.default;
  }
}

export function getMoodSpeed(mood: string): number {
  switch (mood) {
    case 'serene': return 0.7;
    case 'excited': return 1.8;
    case 'contemplative': return 0.4;
    case 'playful': return 1.4;
    case 'melancholic': return 0.5;
    default: return 1.0;
  }
}
