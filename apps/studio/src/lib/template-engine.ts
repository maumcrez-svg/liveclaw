export interface TemplateConfig {
  templateFile: string;
  captureMode: 'desktop' | 'window';
  label: string;
  description: string;
}

export function resolveTemplate(agentType: string): TemplateConfig {
  switch (agentType) {
    case 'chat':
      return {
        templateFile: 'avatar-talking.html',
        captureMode: 'window',
        label: 'Avatar Chat',
        description: 'Avatar with lip sync responding to chat',
      };
    case 'crypto':
    case 'browser':
      return {
        templateFile: 'dashboard.html',
        captureMode: 'window',
        label: 'Dashboard',
        description: 'Data dashboard with live updates',
      };
    case 'news':
      return {
        templateFile: 'browser-kiosk.html',
        captureMode: 'window',
        label: 'News Panel',
        description: 'News feed with headlines',
      };
    case 'game':
    case 'coding':
      return {
        templateFile: 'screen-capture.html',
        captureMode: 'desktop',
        label: 'Screen Capture',
        description: 'Captures your entire screen',
      };
    default:
      return {
        templateFile: 'avatar-talking.html',
        captureMode: 'window',
        label: 'Avatar',
        description: 'Avatar speaking to viewers',
      };
  }
}
