// @ts-nocheck
interface LLMModel {
  id: string;
  provider: string;
  name: string;
  context: string;
  color: string;
  inputCost: string;
  outputCost: string;
}

interface ConnectorConfig {
  id: string;
  label: string;
  color: string;
  fields: { key: string; label: string; placeholder: string; secret?: boolean }[];
}

/* ── Data ───────────────────────────────────────────────────────────────────── */
const LLM_MODELS: LLMModel[] = [
  {
    id: 'anthropic-sonnet-45',
    provider: 'Anthropic',
    name: 'Claude Sonnet 4.5',
    context: '200K',
    color: '#e879f9',
    inputCost: '$3/M',
    outputCost: '$15/M',
  },
  {
    id: 'anthropic-sonnet-4',
    provider: 'Anthropic',
    name: 'Claude Sonnet 4',
    context: '200K',
    color: '#e879f9',
    inputCost: '$3/M',
    outputCost: '$15/M',
  },
  {
    id: 'anthropic-opus-4',
    provider: 'Anthropic',
    name: 'Claude Opus 4',
    context: '200K',
    color: '#c4b5fd',
    inputCost: '$15/M',
    outputCost: '$75/M',
  },
  {
    id: 'anthropic-haiku-35',
    provider: 'Anthropic',
    name: 'Claude Haiku 3.5',
    context: '200K',
    color: '#a78bfa',
    inputCost: '$0.80/M',
    outputCost: '$4/M',
  },
  {
    id: 'openai-gpt41',
    provider: 'OpenAI',
    name: 'GPT-4.1',
    context: '1M',
    color: '#4ade80',
    inputCost: '$2/M',
    outputCost: '$8/M',
  },
  {
    id: 'openai-gpt5',
    provider: 'OpenAI',
    name: 'GPT-5',
    context: '1M',
    color: '#34d399',
    inputCost: '$10/M',
    outputCost: '$40/M',
  },
  {
    id: 'openai-gpt4o',
    provider: 'OpenAI',
    name: 'GPT-4o',
    context: '128K',
    color: '#6ee7b7',
    inputCost: '$2.5/M',
    outputCost: '$10/M',
  },
  {
    id: 'openai-o3',
    provider: 'OpenAI',
    name: 'o3',
    context: '200K',
    color: '#a7f3d0',
    inputCost: '$10/M',
    outputCost: '$40/M',
  },
  {
    id: 'google-gemini25pro',
    provider: 'Google',
    name: 'Gemini 2.5 Pro',
    context: '1M',
    color: '#38bdf8',
    inputCost: '$1.25/M',
    outputCost: '$10/M',
  },
  {
    id: 'google-gemini25fl',
    provider: 'Google',
    name: 'Gemini 2.5 Flash',
    context: '1M',
    color: '#7dd3fc',
    inputCost: '$0.30/M',
    outputCost: '$2.5/M',
  },
  {
    id: 'google-gemini20',
    provider: 'Google',
    name: 'Gemini 2.0 Flash',
    context: '1M',
    color: '#bae6fd',
    inputCost: '$0.10/M',
    outputCost: '$0.40/M',
  },
  {
    id: 'mistral-large',
    provider: 'Mistral',
    name: 'Mistral Large',
    context: '128K',
    color: '#fb923c',
    inputCost: '$2/M',
    outputCost: '$6/M',
  },
  {
    id: 'deepseek-v3',
    provider: 'DeepSeek',
    name: 'DeepSeek V3',
    context: '64K',
    color: '#fbbf24',
    inputCost: '$0.07/M',
    outputCost: '$1.1/M',
  },
  {
    id: 'llama-33-70b',
    provider: 'Meta',
    name: 'Llama 3.3 70B',
    context: '128K',
    color: '#94a3b8',
    inputCost: 'free',
    outputCost: 'free',
  },
  {
    id: 'ollama-local',
    provider: 'Ollama',
    name: 'Local (Ollama)',
    context: 'varies',
    color: '#64748b',
    inputCost: 'free',
    outputCost: 'free',
  },
];

const CONNECTORS: ConnectorConfig[] = [
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    color: '#e879f9',
    fields: [
      { key: 'apiKey', label: 'API KEY', placeholder: 'sk-ant-…', secret: true },
      { key: 'baseUrl', label: 'BASE URL', placeholder: 'https://api.anthropic.com' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI / GPT',
    color: '#4ade80',
    fields: [
      { key: 'apiKey', label: 'API KEY', placeholder: 'sk-…', secret: true },
      { key: 'baseUrl', label: 'BASE URL', placeholder: 'https://api.openai.com/v1' },
      { key: 'orgId', label: 'ORG ID', placeholder: 'org-… (optional)' },
    ],
  },
  {
    id: 'google',
    label: 'Google Gemini',
    color: '#38bdf8',
    fields: [
      { key: 'apiKey', label: 'API KEY', placeholder: 'AIza…', secret: true },
      { key: 'project', label: 'PROJECT ID', placeholder: 'my-project-id' },
    ],
  },
  {
    id: 'mt5bridge',
    label: 'MT5 Bridge',
    color: JADE,
    fields: [
      { key: 'host', label: 'HOST', placeholder: '127.0.0.1' },
      { key: 'port', label: 'PORT', placeholder: '1234' },
      { key: 'token', label: 'AUTH TOKEN', placeholder: 'optional', secret: true },
    ],
  },
  {
    id: 'n8n',
    label: 'n8n Webhook',
    color: AMBER,
    fields: [
      { key: 'url', label: 'WEBHOOK URL', placeholder: 'http://localhost:5678/webhook/…' },
      { key: 'apiKey', label: 'API KEY', placeholder: 'optional', secret: true },
    ],
  },
  {
    id: 'ollama',
    label: 'Ollama (Local)',
    color: '#64748b',
    fields: [
      { key: 'baseUrl', label: 'BASE URL', placeholder: 'http://localhost:11434' },
      { key: 'model', label: 'DEFAULT MODEL', placeholder: 'llama3.3:70b' },
    ],
  },
  {
    id: 'custom',
    label: 'Custom REST Endpoint',
    color: VIOLET,
    fields: [
      { key: 'name', label: 'NAME', placeholder: 'My API' },
      { key: 'url', label: 'ENDPOINT', placeholder: 'https://…' },
      { key: 'apiKey', label: 'AUTH HEADER', placeholder: 'Bearer …', secret: true },
    ],
  },
];

type AdminTab = 'MODELS' | 'CONNECTORS' | 'PATHS' | 'TOOLS' | 'SOCIAL';

export type { LLMModel, ConnectorConfig, AdminTab };
export { LLM_MODELS, CONNECTORS };
