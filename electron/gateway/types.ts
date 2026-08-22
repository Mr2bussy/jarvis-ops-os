export type GatewayPlatform = 'telegram' | 'discord' | 'slack' | 'cli' | 'internal';

export interface GatewayConfig {
  enabled: boolean;
  brand: 'hermes-router';
  pollIntervalMs: number;
  platforms: Record<GatewayPlatform, boolean>;
  allowedUserIds: Partial<Record<GatewayPlatform, string[]>>;
}

export interface GatewayStatus {
  running: boolean;
  brand: string;
  platforms: Partial<Record<GatewayPlatform, { configured: boolean; active: boolean; lastError?: string }>>;
  lastInbound?: { platform: GatewayPlatform; at: string; preview: string };
  messagesHandled: number;
}

export interface InboundMessage {
  platform: GatewayPlatform;
  userId: string;
  chatId: string;
  text: string;
  at: string;
}

export type MessageHandler = (msg: InboundMessage) => Promise<string>;
