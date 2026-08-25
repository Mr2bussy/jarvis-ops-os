export {};

export type SysMetrics = {
  host: string;
  platform: string;
  arch: string;
  release: string;
  uptime: number;
  cpu_count: number;
  cpu_model: string;
  cpu_util: number;
  cpu_per_core: number[];
  cpu_speed_mhz: number;
  load_avg: number[];
  mem_total_gb: number;
  mem_used_gb: number;
  mem_pct: number;
  disk_used_gb: number;
  disk_total_gb: number;
  disk_pct: number;
  disk_drives: { caption: string; used_gb: number; total_gb: number }[];
  net_ifaces: number;
  user: string;
  home: string;
  ts: number;
};

export type AppEntry = {
  id: string;
  name: string;
  path: string;
  kind: 'exe' | 'url' | 'folder' | 'cmd';
  tag?: string;
  addedAt: number;
};

export type ActivityEntry = { ts: number; who: string; action: string; target: string };

export type ComposioApp = { slug: string; name: string; categories: string[] };

declare global {
  interface Window {
    jarvisBridge: {
      complete: (payload: {
        messages: { role: 'user' | 'assistant'; content: string }[];
        system?: string;
        maxTokens?: number;
      }) => Promise<string>;
      hasKey: () => Promise<boolean>;

      systemMetrics: () => Promise<SysMetrics>;
      recentActivity: () => Promise<ActivityEntry[]>;
      notify: (title: string, body: string) => Promise<boolean>;
      onShortcut: (cb: (key: string) => void) => void;

      config: {
        setKey: (name: string, value: string) => Promise<boolean>;
        getKey: (name: string) => Promise<string>;
        hasKey: (name: string) => Promise<boolean>;
        deleteKey: (name: string) => Promise<boolean>;
        getMt5: () => Promise<{ host: string; port: number }>;
        setMt5: (host: string, port: number) => Promise<boolean>;
        reloadKeys: () => Promise<boolean>;
        getAdvancedMode: () => Promise<boolean>;
        setAdvancedMode: (on: boolean) => Promise<boolean>;
      };

      startBridge: () => Promise<boolean>;

      appsList: () => Promise<AppEntry[]>;
      appsAdd: (entry: {
        name: string;
        path: string;
        kind: 'exe' | 'url' | 'folder' | 'cmd';
        tag?: string;
      }) => Promise<AppEntry>;
      appsRemove: (id: string) => Promise<boolean>;
      appsPick: (kind: 'exe' | 'folder') => Promise<string | null>;
      appsLaunch: (entry: AppEntry) => Promise<{ ok: boolean; err?: string }>;
      appsScanCommon: () => Promise<{ name: string; path: string }[]>;

      workspace: () => Promise<{
        agentsPath: string;
        skillsIndexPath: string;
        agentCount: number;
        skillsTotal: number;
        host: string;
        user: string;
        platform: string;
        home: string;
      }>;
      scanAgents: () => Promise<
        { id: string; name: string; desc: string; tools: string[]; file: string; cat: string }[]
      >;
      liveScan: () => Promise<{
        total: number;
        byCategory: Record<string, number>;
        lastModTs: number;
        scanTs: number;
      }>;
      rebuildIndex: () => Promise<{ total: number; entries: unknown[] } | null>;
      writeFile: (p: { filePath: string; content: string }) => Promise<{ ok: boolean; err?: string }>;
      readFileContent: (filePath: string) => Promise<{ ok: boolean; content: string; err?: string }>;

      zeusPing: (url: string) => Promise<{ ok: boolean; status: number; body?: string; err?: string }>;
      mt5: (payload: {
        host: string;
        port: number;
        endpoint: string;
        method?: 'GET' | 'POST';
        body?: unknown;
      }) => Promise<{ ok: boolean; status: number; data?: unknown; err?: string }>;

      geminiComplete: (payload: {
        messages: { role: 'user' | 'model'; text: string }[];
        system?: string;
      }) => Promise<string>;
      geminiAudio: (payload: { audioBase64: string; mimeType: string; system?: string }) => Promise<string>;
      geminiTranscribe: (payload: { audioBase64: string; mimeType: string }) => Promise<string>;
      hasGemini: () => Promise<boolean>;
      voiceDiag: () => Promise<Record<string, unknown>>;
      githubComplete: (payload: {
        messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
        system?: string;
        maxTokens?: number;
      }) => Promise<string>;
      hasGithub: () => Promise<boolean>;
      qwenComplete: (payload: {
        messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
        system?: string;
        maxTokens?: number;
      }) => Promise<string>;
      hasQwen: () => Promise<boolean>;
      ollamaComplete: (payload: {
        messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
        system?: string;
        maxTokens?: number;
      }) => Promise<string>;
      hasOllama: () => Promise<boolean>;
      ollamaTranscribe: (payload: { audioBase64: string; mimeType: string }) => Promise<string>;

      // Console / Dev tools
      consoleRun: (cmd: string) => Promise<{ ok: boolean; stdout?: string; stderr?: string; err?: string }>;

      // System Tools
      systemTools: {
        openTool: (toolId: string) => Promise<void>;
        getProcs: () => Promise<unknown[]>;
        clearTemp: () => Promise<{ freed: number }>;
        memReduce: () => Promise<{ freed: number }>;
        fileSearch: (query: string) => Promise<string[]>;
        netScan: () => Promise<unknown[]>;
      };

      // Workflow Scheduler
      workflowSchedule: (config: {
        id: string;
        expression: string;
        workflowId: string;
        workflowName: string;
        prompt: string;
        channel: string;
      }) => Promise<{ ok: boolean; id?: string }>;
      workflowCancel: (id: string) => Promise<boolean>;
      workflowListScheduled: () => Promise<
        {
          id: string;
          workflowId: string;
          workflowName: string;
          expression: string;
          runCount: number;
          lastRun?: number;
        }[]
      >;

      // Provider live ping (A4)
      testProvider: (provider: string) => Promise<{ ok: boolean; status?: number; error?: string }>;

      // Social Media (B2)
      postToX: (payload: {
        text: string;
        apiKey: string;
        apiSecret: string;
        accessToken: string;
        accessSecret: string;
      }) => Promise<{ ok: boolean; id?: string; error?: string }>;
      postToInstagram: (payload: {
        imageUrl: string;
        caption: string;
        accessToken: string;
        igUserId: string;
      }) => Promise<{ ok: boolean; id?: string; error?: string }>;

      // Streaming (P1)
      completeStream: (
        payload: {
          messages: { role: 'user' | 'assistant'; content: string }[];
          system?: string;
          maxTokens?: number;
        },
        streamId: string,
      ) => Promise<string>;
      onStreamChunk: (cb: (data: { id: string; text: string }) => void) => void;
      offStreamChunk: () => void;
      onStreamDone: (cb: (data: { id: string }) => void) => void;
      offStreamDone: () => void;

      // Web search (P3)
      searchWeb: (query: string) => Promise<{ title: string; url: string; snippet: string }[]>;

      // Composio integrations
      composio: {
        has: () => Promise<boolean>;
        catalog: () => Promise<{ apps: ComposioApp[]; byCategory: Record<string, ComposioApp[]> }>;
        execute: (payload: {
          slug: string;
          arguments?: Record<string, unknown>;
          userId?: string;
          connectedAccountId?: string;
        }) => Promise<unknown>;
        connections: () => Promise<unknown>;
        initiate: (...args: unknown[]) => Promise<unknown>;
      };

      shell: {
        openExternal: (url: string) => Promise<boolean>;
      };

      browser: {
        install: (...args: unknown[]) => Promise<unknown>;
      };

      employees: {
        emailFetchInbox: (...args: unknown[]) => Promise<unknown>;
      };

      activateVaultAgents: (...args: unknown[]) => Promise<unknown>;
      freeTranscribe: (...args: unknown[]) => Promise<unknown>;
      getVaultPaths: (...args: unknown[]) => Promise<unknown>;
      setAgentsPath: (...args: unknown[]) => Promise<unknown>;
      systemSelfTest: (...args: unknown[]) => Promise<unknown>;
      voiceSelfTest: (...args: unknown[]) => Promise<unknown>;
      voiceSession: (...args: unknown[]) => Promise<unknown>;
      voicePickFiles: (...args: unknown[]) => Promise<unknown>;

      memory: {
        embedSearch: (...args: unknown[]) => Promise<unknown>;
        embedUpsert: (...args: unknown[]) => Promise<unknown>;
      };

      trading: {
        ccxtOhlcv: (...args: unknown[]) => Promise<unknown>;
        ccxtStatus: (...args: unknown[]) => Promise<unknown>;
        ccxtTicker: (...args: unknown[]) => Promise<unknown>;
        econCalendar: (...args: unknown[]) => Promise<unknown>;
        inNewsWindow: (...args: unknown[]) => Promise<unknown>;
        journalAdd: (...args: unknown[]) => Promise<unknown>;
        journalList: (...args: unknown[]) => Promise<unknown>;
        journalWeekly: (...args: unknown[]) => Promise<unknown>;
      };

      voice: {
        piperSpeak: (...args: unknown[]) => Promise<unknown>;
        piperStatus: (...args: unknown[]) => Promise<unknown>;
      };

      harness: {
        status: () => Promise<{ ok: boolean; data?: unknown; err?: string }>;
        run: (payload: { sessionId: string; message: string; verifierId?: string }) => Promise<{
          ok: boolean;
          turns?: unknown[];
          err?: string;
        }>;
        refine: (payload: {
          sessionId: string;
          evidence: string;
          lesson: string;
          skillName?: string;
        }) => Promise<{ ok: boolean; data?: unknown; err?: string }>;
        memorySearch: (
          query: string,
          limit?: number,
        ) => Promise<{ ok: boolean; data?: unknown; err?: string }>;
        hitlPending: () => Promise<{ ok: boolean; data?: unknown; err?: string }>;
        hitlResolve: (
          id: string,
          approved: boolean,
        ) => Promise<{ ok: boolean; data?: unknown; err?: string }>;
        benchSmoke: () => Promise<{ ok: boolean; data?: unknown; err?: string }>;
        swarmPlan: (message: string) => Promise<{ ok: boolean; data?: unknown; err?: string }>;
        onHitlRequest?: (
          cb: (entry: {
            id: string;
            reason: string;
            payload: Record<string, unknown>;
            createdAt: string;
          }) => void,
        ) => (() => void) | void;
        weeklyRun: (useLlmCritic?: boolean) => Promise<{ ok: boolean; data?: unknown; err?: string }>;
      };

      gateway: {
        status: () => Promise<{ ok: boolean; data?: unknown; err?: string }>;
        configGet: () => Promise<{ ok: boolean; data?: unknown; err?: string }>;
        configSet: (patch: Record<string, unknown>) => Promise<{ ok: boolean; data?: unknown; err?: string }>;
        start: () => Promise<{ ok: boolean; err?: string }>;
        stop: () => Promise<{ ok: boolean; err?: string }>;
        deliver: (platform: string, text: string) => Promise<{ ok: boolean; err?: string }>;
      };

      commerce?: {
        sync: () => Promise<unknown>;
      };
      content?: {
        publish: (payload: unknown) => Promise<unknown>;
      };

      production?: {
        dryRun: () => Promise<unknown>;
        errorBudget: () => Promise<{
          availabilityPct: number;
          budgetRemainingPct: number;
          sloTargetPct: number;
          requests: number;
          failures: number;
          avgVoiceE2eMs: number | null;
          p95VoiceE2eMs?: number | null;
          voiceSloMs?: number;
          voiceSloBreached?: boolean;
          modelProbeOk: boolean | null;
          modelProbeLatencyMs: number | null;
          hitlPending: number;
          employeeFailures: number;
        }>;
        recordVoiceLatency: (
          totalMs: number,
          ttfbMs?: number,
        ) => Promise<{ ok: boolean; voiceSloBreached?: boolean }>;
        flags: () => Promise<Record<string, boolean>>;
        setFlag: (key: string, value: boolean) => Promise<Record<string, boolean>>;
        killSwitch: (on: boolean) => Promise<{ ok: boolean; on: boolean }>;
        checkUpdates: () => Promise<unknown>;
        downloadUpdate: () => Promise<unknown>;
        installUpdate: () => Promise<unknown>;
        crashDumpsPath: () => Promise<unknown>;
        exportConfig: () => Promise<unknown>;
        auditTrail: () => Promise<unknown>;
        employeeHealth: () => Promise<unknown>;
        employeeExecute: () => Promise<unknown>;
        imapIdleStatus: () => Promise<unknown>;
      };

      onUpdateFeedStatus?: (
        cb: (status: {
          feedUrl: string | null;
          source: string;
          packaged: boolean;
          failClosed: boolean;
          reason?: string;
        }) => void,
      ) => (() => void) | void;
    };
  }
}
