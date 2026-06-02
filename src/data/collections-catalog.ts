// JARVIS Collections Catalog
// Sources:
//   github-gamechangers/   — 19 sub-collections totalling ~13,000+ files
//   antigravity-awesome-skills/skills/ — 1,420 skill folders

export interface Collection {
  id: string;
  slug: string;
  name: string;
  desc: string;
  fileCount: number;
  tag: string;
  color: string;
}

// ── github-gamechangers sub-collections ───────────────────────────────────────
export const GAMECHANGERS: Collection[] = [
  { id:'GC-01', slug:'agency-agents-zh',                    name:'Agency Agents ZH',              fileCount: 236,  tag:'AGENTS',      color:'#e879f9', desc:'Chinese-language agentic AI workflows and multi-agent orchestration patterns.' },
  { id:'GC-02', slug:'agent-skills-standard',               name:'Agent Skills Standard',         fileCount: 841,  tag:'SKILLS',      color:'#00e5ff', desc:'Official GitHub Copilot agent skill standard definitions and boilerplate.' },
  { id:'GC-03', slug:'ai-prompts',                          name:'AI Prompts',                    fileCount: 162,  tag:'PROMPTS',     color:'#fbbf24', desc:'Curated AI prompt templates for development, writing, analysis, and reasoning.' },
  { id:'GC-04', slug:'antigravity-awesome-skills',          name:'Antigravity Awesome Skills',    fileCount: 7889, tag:'MEGA',        color:'#c8fb4e', desc:'The full Antigravity curated skills repository — 1,420 skill folders, all domains.' },
  { id:'GC-05', slug:'awesome-claude-code',                 name:'Awesome Claude Code',           fileCount: 129,  tag:'CLAUDE',      color:'#fb923c', desc:'Curated Claude Code workflows, CLAUDE.md patterns, and automation scripts.' },
  { id:'GC-06', slug:'awesome-claude-skills',               name:'Awesome Claude Skills',         fileCount: 892,  tag:'CLAUDE',      color:'#fb923c', desc:'Community-curated skills specifically designed for Claude Code and Claude API.' },
  { id:'GC-07', slug:'awesome-copilot-agents',              name:'Awesome Copilot Agents',        fileCount: 404,  tag:'AGENTS',      color:'#818cf8', desc:'Community-curated GitHub Copilot agents collection covering all development domains.' },
  { id:'GC-08', slug:'awesome-copilot-for-testers',         name:'Copilot for Testers',           fileCount: 80,   tag:'TESTING',     color:'#34d399', desc:'GitHub Copilot agents, prompts, and instructions tailored for QA and testing workflows.' },
  { id:'GC-09', slug:'dev-skills',                          name:'Dev Skills',                    fileCount: 43,   tag:'SKILLS',      color:'#00e5ff', desc:'Core developer productivity skills: Git, review, docs, refactor, and debugging.' },
  { id:'GC-10', slug:'everything-claude-code',              name:'Everything Claude Code',        fileCount: 1352, tag:'CLAUDE',      color:'#fb923c', desc:'Comprehensive Claude Code reference — settings, slash commands, skills, and advanced usage.' },
  { id:'GC-11', slug:'github-copilot-configs',              name:'GitHub Copilot Configs',        fileCount: 365,  tag:'CONFIGS',     color:'#38bdf8', desc:'Real-world .github/copilot-instructions.md and configuration files from popular repos.' },
  { id:'GC-12', slug:'kilocode',                            name:'KiloCode',                      fileCount: 342,  tag:'SKILLS',      color:'#a78bfa', desc:'KiloCode AI skills and modes for autonomous coding across stacks.' },
  { id:'GC-13', slug:'pro-workflow',                        name:'Pro Workflow',                  fileCount: 77,   tag:'WORKFLOW',    color:'#c8fb4e', desc:'Professional development workflow templates: feature, hotfix, release, and incident.' },
  { id:'GC-14', slug:'Prompt-Engineering-Guide',            name:'Prompt Engineering Guide',      fileCount: 12,   tag:'GUIDE',       color:'#fbbf24', desc:'Structured prompt engineering guide covering principles, patterns, and advanced techniques.' },
  { id:'GC-15', slug:'ruler',                               name:'Ruler',                         fileCount: 11,   tag:'RULES',       color:'#94a3b8', desc:'Code quality rules and automated linting standards for modern projects.' },
  { id:'GC-16', slug:'serena',                              name:'Serena',                        fileCount: 47,   tag:'FRAMEWORK',   color:'#f472b6', desc:'Serena AI agent framework for structured multi-step code editing and refactoring.' },
  { id:'GC-17', slug:'skillkit',                            name:'Skillkit',                      fileCount: 15,   tag:'TOOLKIT',     color:'#38bdf8', desc:'Skill development toolkit for authoring, testing, and publishing new copilot skills.' },
  { id:'GC-18', slug:'system-prompts-and-models-of-ai-tools',name:'System Prompts of AI Tools',  fileCount: 3,    tag:'PROMPTS',     color:'#fbbf24', desc:'Leaked and documented system prompts and model cards for popular AI products.' },
  { id:'GC-19', slug:'THERION-SYSTEM',                      name:'THERION System',                fileCount: 21,   tag:'SYSTEM',      color:'#e879f9', desc:'THERION autonomous coding system — multi-agent orchestration and self-improvement loops.' },
];

// ── Antigravity skill categories (from 1,420 skill folders) ──────────────────
export interface SkillCategory {
  label: string;
  count: number;
  color: string;
  examples: string[];
}

export const ANTIGRAVITY_CATEGORIES: SkillCategory[] = [
  { label:'Azure / Cloud',    count: 180, color:'#818cf8', examples:['azure-ai-projects-py','azure-cosmos-py','azure-keyvault-py','azure-storage-blob-ts','azure-functions','azure-identity-dotnet'] },
  { label:'Security',         count: 145, color:'#f87171', examples:['security-auditor','pentest-checklist','vulnerability-scanner','red-team-tactics','sql-injection-testing','xss-html-injection','burp-suite-testing'] },
  { label:'Frontend / UI',    count: 130, color:'#34d399', examples:['react-best-practices','nextjs-app-router-patterns','ui-ux-designer','swiftui-expert-skill','tailwind-design-system','shadcn','threejs-skills'] },
  { label:'Backend / APIs',   count: 125, color:'#a78bfa', examples:['fastapi-pro','nodejs-backend-patterns','nestjs-expert','django-pro','graphql-architect','grpc-golang','trpc-fullstack'] },
  { label:'AI / LLM / Agents',count: 120, color:'#00e5ff', examples:['llm-app-patterns','langchain-architecture','rag-implementation','agent-orchestrator','multi-agent-patterns','prompt-engineer','pydantic-ai'] },
  { label:'DevOps / CI/CD',   count: 95,  color:'#fb923c', examples:['github-actions-templates','cicd-automation-workflow-automate','kubernetes-architect','terraform-infrastructure','docker-expert','gitops-workflow'] },
  { label:'Automation / CRM', count: 90,  color:'#fbbf24', examples:['hubspot-automation','salesforce-automation','n8n-workflow-patterns','zapier-make-patterns','slack-automation','notion-automation'] },
  { label:'SEO / Marketing',  count: 85,  color:'#c8fb4e', examples:['seo-fundamentals','seo-content-writer','seo-aeo-blog-writer','content-marketer','growth-engine','social-content'] },
  { label:'Data / Analytics', count: 75,  color:'#f472b6', examples:['data-engineer','database-architect','postgresql-optimization','snowflake-development','dbt-transformation-patterns','powerbi-modeling'] },
  { label:'Mobile / Native',  count: 55,  color:'#38bdf8', examples:['ios-developer','flutter-expert','react-native-architecture','android-jetpack-compose-expert','expo-deployment','swiftui-liquid-glass'] },
  { label:'Testing / QA',     count: 50,  color:'#4ade80', examples:['tdd-orchestrator','playwright-skill','performance-testing-review-ai-review','e2e-testing','test-automator','k6-load-testing'] },
  { label:'Writing / Content',count: 40,  color:'#a78bfa', examples:['copywriting','scientific-writing','documentation','blog-writing-guide','professional-proofreader','content-creator'] },
  { label:'Blockchain / Web3',count: 25,  color:'#fbbf24', examples:['blockchain-developer','solidity-security','defi-protocol-templates','web3-testing','nft-standards'] },
  { label:'Other',            count: 225, color:'#94a3b8', examples:['daily-gift','mermaid-expert','pdf','csv-tools','libreoffice','moyu','idea-os'] },
];

export const ANTIGRAVITY_TOTAL_SKILLS = 1420;

export const GAMECHANGERS_TOTAL = GAMECHANGERS.reduce((s, c) => s + c.fileCount, 0);
export const GAMECHANGERS_COUNT  = GAMECHANGERS.length;

// ── Awesome AI Apps (awesome-ai-apps/ — real runnable agent projects) ─────────
export interface AppCategory {
  id: string;
  label: string;
  emoji: string;
  count: number;
  color: string;
  desc: string;
  examples: string[];
}

export const AWESOME_AI_APP_CATEGORIES: AppCategory[] = [
  {
    id: 'AAA-01', label: 'Advanced Agents', emoji: '🔬', count: 23, color: '#e879f9',
    desc: 'Production-grade multi-agent systems for finance, research, legal, and sales intelligence.',
    examples: ['ai-hedgefund', 'deep_researcher_agent', 'due_diligence_agent', 'paralegal_crew', 'trend_analyzer_agent', 'smart_gtm_agent', 'finance_service_agent'],
  },
  {
    id: 'AAA-02', label: 'Simple Agents', emoji: '🪶', count: 16, color: '#34d399',
    desc: 'Lightweight single-purpose agents for scheduling, stock analysis, newsletter, and reasoning.',
    examples: ['browser_agent', 'finance_agent', 'reasoning_agent', 'newsletter_agent', 'stock_portfolio_analyst', 'talk_to_db', 'human_in_the_loop_agent'],
  },
  {
    id: 'AAA-03', label: 'MCP Agents', emoji: '🗂️', count: 13, color: '#38bdf8',
    desc: 'Model Context Protocol agents: GitHub, database, Docker, telemetry, and custom MCP servers.',
    examples: ['github_mcp_agent', 'database_mcp_agent', 'e2b_docker_mcp_agent', 'docs_qna_agent', 'custom_mcp_server', 'hotel_finder_agent'],
  },
  {
    id: 'AAA-04', label: 'Voice Agents', emoji: '🎙️', count: 7, color: '#fb923c',
    desc: 'Real-time voice AI agents for healthcare, hospitality, and web search using LiveKit & Pipecat.',
    examples: ['healthcare_contact_center', 'livekit_gemini_agents', 'pipecat_agent', 'speed_to_lead_agent', 'voice-agent-gradium-nebius-langchain'],
  },
  {
    id: 'AAA-05', label: 'RAG Applications', emoji: '📚', count: 16, color: '#a78bfa',
    desc: 'Retrieval-Augmented Generation apps: PDF analysis, GraphRAG, video RAG, code search, and OCR.',
    examples: ['agentic_rag', 'graphrag_neo4j', 'pdf_rag_analyser', 'video_rag', 'chat_with_code', 'contextual_ai_rag', 'resume_optimizer'],
  },
  {
    id: 'AAA-06', label: 'Memory Agents', emoji: '🧠', count: 12, color: '#f472b6',
    desc: 'Persistent-memory agents for brand monitoring, social media, job search, and study coaching.',
    examples: ['brand_reputation_monitor', 'youtube_trend_agent', 'social_media_agent', 'job_search_agent', 'study_coach_agent', 'ai_consultant_agent'],
  },
  {
    id: 'AAA-07', label: 'Starter Agents', emoji: '🚀', count: 19, color: '#fbbf24',
    desc: 'Framework quickstart templates: CrewAI, LangGraph, AutoGen, LlamaIndex, Mastra, DSPy and more.',
    examples: ['crewai_starter', 'langgraph_starter', 'autogen_starter', 'openai_agents_sdk', 'llamaindex_starter', 'pydantic_starter', 'semantic_kernel_starter'],
  },
  {
    id: 'AAA-08', label: 'Fine-Tuning', emoji: '⚗️', count: 6, color: '#818cf8',
    desc: 'LLM fine-tuning samples for customer support, legal-tech, insurance claims, and open-source models.',
    examples: ['customer_support_datalab', 'insurance_claims_finetuning', 'legal-tech-fine-tuning-nebius-cloud', 'open_source_llms_token_factory'],
  },
  {
    id: 'AAA-09', label: 'Agent Examples', emoji: '🧩', count: 2, color: '#00e5ff',
    desc: 'End-to-end showcase agents: LangChain data agent POC and Nebius travel planner.',
    examples: ['langchain_data_agent_poc', 'nebius_travel_planner'],
  },
];

export const AWESOME_AI_APPS_TOTAL = AWESOME_AI_APP_CATEGORIES.reduce((s, c) => s + c.count, 0);
export const AWESOME_AI_APPS_COUNT = AWESOME_AI_APP_CATEGORIES.length;

// ── Plugins (plugins/ — 45 Copilot plugin packages) ──────────────────────────
export interface PluginEntry {
  slug: string;
  name: string;
  tag: string;
  color: string;
}

export const PLUGINS: PluginEntry[] = [
  { slug:'awesome-copilot',                          name:'Awesome Copilot',                     tag:'COPILOT',    color:'#818cf8' },
  { slug:'azure-cloud-development',                  name:'Azure Cloud Dev',                     tag:'AZURE',      color:'#38bdf8' },
  { slug:'cast-imaging',                             name:'CAST Imaging',                        tag:'ANALYSIS',   color:'#fb923c' },
  { slug:'clojure-interactive-programming',          name:'Clojure Interactive',                 tag:'LANG',       color:'#34d399' },
  { slug:'context-engineering',                      name:'Context Engineering',                 tag:'CONTEXT',    color:'#c8fb4e' },
  { slug:'copilot-sdk',                              name:'Copilot SDK',                         tag:'SDK',        color:'#00e5ff' },
  { slug:'csharp-dotnet-development',                name:'C# .NET Development',                 tag:'DOTNET',     color:'#a78bfa' },
  { slug:'csharp-mcp-development',                   name:'C# MCP Dev',                          tag:'MCP',        color:'#a78bfa' },
  { slug:'database-data-management',                 name:'Database & Data Mgmt',                tag:'DB',         color:'#f472b6' },
  { slug:'dataverse-sdk-for-python',                 name:'Dataverse SDK for Python',            tag:'SDK',        color:'#fbbf24' },
  { slug:'devops-oncall',                            name:'DevOps On-Call',                      tag:'DEVOPS',     color:'#fb923c' },
  { slug:'edge-ai-tasks',                            name:'Edge AI Tasks',                       tag:'AI',         color:'#c8fb4e' },
  { slug:'frontend-web-dev',                         name:'Frontend / Web Dev',                  tag:'FRONTEND',   color:'#34d399' },
  { slug:'gem-team',                                 name:'Gem Team',                            tag:'TEAM',       color:'#e879f9' },
  { slug:'go-mcp-development',                       name:'Go MCP Dev',                          tag:'MCP',        color:'#38bdf8' },
  { slug:'java-development',                         name:'Java Development',                    tag:'LANG',       color:'#fb923c' },
  { slug:'java-mcp-development',                     name:'Java MCP Dev',                        tag:'MCP',        color:'#fb923c' },
  { slug:'kotlin-mcp-development',                   name:'Kotlin MCP Dev',                      tag:'MCP',        color:'#a78bfa' },
  { slug:'mcp-m365-copilot',                         name:'MCP M365 Copilot',                    tag:'M365',       color:'#818cf8' },
  { slug:'openapi-to-application-csharp-dotnet',     name:'OpenAPI → C# App',                    tag:'OPENAPI',    color:'#a78bfa' },
  { slug:'openapi-to-application-go',                name:'OpenAPI → Go App',                    tag:'OPENAPI',    color:'#38bdf8' },
  { slug:'openapi-to-application-java-spring-boot',  name:'OpenAPI → Spring Boot',               tag:'OPENAPI',    color:'#fb923c' },
  { slug:'openapi-to-application-nodejs-nestjs',     name:'OpenAPI → NestJS App',                tag:'OPENAPI',    color:'#c8fb4e' },
  { slug:'openapi-to-application-python-fastapi',    name:'OpenAPI → FastAPI App',               tag:'OPENAPI',    color:'#34d399' },
  { slug:'ospo-sponsorship',                         name:'OSPO Sponsorship',                    tag:'OSS',        color:'#94a3b8' },
  { slug:'partners',                                 name:'Partners',                            tag:'PARTNER',    color:'#94a3b8' },
  { slug:'pcf-development',                          name:'PCF Development',                     tag:'PCF',        color:'#818cf8' },
  { slug:'php-mcp-development',                      name:'PHP MCP Dev',                         tag:'MCP',        color:'#818cf8' },
  { slug:'polyglot-test-agent',                      name:'Polyglot Test Agent',                 tag:'TESTING',    color:'#34d399' },
  { slug:'power-apps-code-apps',                     name:'Power Apps Code',                     tag:'POWER',      color:'#818cf8' },
  { slug:'power-bi-development',                     name:'Power BI Dev',                        tag:'POWER',      color:'#fbbf24' },
  { slug:'power-platform-mcp-connector-development', name:'Power Platform MCP',                  tag:'MCP',        color:'#818cf8' },
  { slug:'project-planning',                         name:'Project Planning',                    tag:'WORKFLOW',   color:'#c8fb4e' },
  { slug:'python-mcp-development',                   name:'Python MCP Dev',                      tag:'MCP',        color:'#34d399' },
  { slug:'ruby-mcp-development',                     name:'Ruby MCP Dev',                        tag:'MCP',        color:'#f87171' },
  { slug:'rug-agentic-workflow',                     name:'RUG Agentic Workflow',                 tag:'WORKFLOW',   color:'#e879f9' },
  { slug:'rust-mcp-development',                     name:'Rust MCP Dev',                        tag:'MCP',        color:'#fb923c' },
  { slug:'security-best-practices',                  name:'Security Best Practices',             tag:'SECURITY',   color:'#f87171' },
  { slug:'software-engineering-team',                name:'Software Eng Team',                   tag:'TEAM',       color:'#00e5ff' },
  { slug:'structured-autonomy',                      name:'Structured Autonomy',                 tag:'AGENTS',     color:'#c8fb4e' },
  { slug:'swift-mcp-development',                    name:'Swift MCP Dev',                       tag:'MCP',        color:'#fb923c' },
  { slug:'technical-spike',                          name:'Technical Spike',                     tag:'RESEARCH',   color:'#94a3b8' },
  { slug:'testing-automation',                       name:'Testing & Automation',                tag:'TESTING',    color:'#34d399' },
  { slug:'typescript-mcp-development',               name:'TypeScript MCP Dev',                  tag:'MCP',        color:'#38bdf8' },
  { slug:'typespec-m365-copilot',                    name:'TypeSpec M365 Copilot',               tag:'M365',       color:'#818cf8' },
];

export const PLUGINS_COUNT = PLUGINS.length;

// ── Skill Collections (top-level standalone repos) ────────────────────────────
export interface SkillCollection { id:string; slug:string; name:string; desc:string; tag:string; color:string; path:string; }
export const SKILL_COLLECTIONS: SkillCollection[] = [
  { id:'SC-01', slug:'agent-skills',            name:'Agent Skills',        desc:'Addyosmani curated agent skills — structured SKILL.md definitions for GitHub Copilot agents.',    tag:'SKILLS', color:'#00e5ff', path:'agent-skills' },
  { id:'SC-02', slug:'andrej-karpathy-skills',  name:'Karpathy Skills',     desc:'Andrej Karpathy AI/ML skills — deep learning, neural nets, LLM implementation guides.',          tag:'AI/ML',  color:'#818cf8', path:'andrej-karpathy-skills' },
  { id:'SC-03', slug:'awesome-openclaw-skills', name:'OpenClaw Skills',     desc:'Awesome OpenClaw skills — agent frameworks, tool use, and agentic workflow patterns.',           tag:'AGENTS', color:'#e879f9', path:'awesome-openclaw-skills' },
  { id:'SC-04', slug:'superpowers',             name:'Superpowers',         desc:'AI superpowers — leverage AI tools as force multipliers for dev productivity.',                  tag:'SKILLS', color:'#c8fb4e', path:'superpowers' },
];

// ── External Projects (external/ — cloned/downloaded repos) ──────────────────
export interface ExternalProject { id:string; slug:string; name:string; desc:string; tag:string; color:string; path:string; }
export const EXTERNAL_PROJECTS: ExternalProject[] = [
  { id:'EXT-01', slug:'ai-hedge-fund',        name:'AI Hedge Fund',        desc:'Multi-agent AI hedge fund — market analysis, signal generation, and automated trading.',          tag:'TRADING', color:'#4ade80', path:'external/ai-hedge-fund' },
  { id:'EXT-02', slug:'BB-Terminal',          name:'BB Terminal',          desc:'Bloomberg-style trading terminal — real-time market data, charts, and execution interface.',      tag:'TRADING', color:'#4ade80', path:'external/BB-Terminal' },
  { id:'EXT-03', slug:'claude-mem',           name:'Claude Memory',        desc:'Persistent memory layer for Claude — context, notes, and session state across conversations.',    tag:'AI',      color:'#fb923c', path:'external/claude-mem' },
  { id:'EXT-04', slug:'hackingtool',          name:'Hacking Toolkit',      desc:'Comprehensive ethical hacking and penetration testing toolkit collection.',                       tag:'SECURITY',color:'#f87171', path:'external/hackingtool' },
  { id:'EXT-05', slug:'hyperswitch',          name:'Hyperswitch',          desc:'Open-source payment orchestration — route payments across 50+ processors and gateways.',          tag:'FINTECH', color:'#818cf8', path:'external/hyperswitch' },
  { id:'EXT-06', slug:'JARVIS',               name:'Microsoft JARVIS',     desc:'Microsoft JARVIS — task planning with HuggingFace model execution pipeline.',                    tag:'AI',      color:'#00e5ff', path:'external/JARVIS' },
  { id:'EXT-07', slug:'jcode',                name:'JCode',                desc:'Advanced code generation and transformation toolkit for multi-language projects.',                tag:'DEV',     color:'#a78bfa', path:'external/jcode' },
  { id:'EXT-08', slug:'local-deep-research',  name:'Local Deep Research',  desc:'Offline deep research agent — multi-step retrieval and synthesis without cloud dependency.',      tag:'AI',      color:'#00e5ff', path:'external/local-deep-research' },
  { id:'EXT-09', slug:'maybe',                name:'Maybe Finance',        desc:'Open-source personal finance OS — net worth, budgeting, and investment tracking.',                tag:'FINANCE', color:'#34d399', path:'external/maybe' },
  { id:'EXT-10', slug:'MoneyPrinterTurbo',    name:'MoneyPrinterTurbo',    desc:'Automated AI video creation — scripts, voiceover, and auto-upload to YouTube.',                  tag:'CONTENT', color:'#fbbf24', path:'external/MoneyPrinterTurbo' },
  { id:'EXT-11', slug:'nexus_hud_v2',         name:'Nexus HUD v2',         desc:'Cyberpunk desktop HUD overlay — system stats, widgets, and real-time data panels.',              tag:'UI',      color:'#c8fb4e', path:'external/nexus_hud_v2' },
  { id:'EXT-12', slug:'nicedreamzapp',        name:'NiceDreams App',       desc:'Wellness app — sleep quality tracking, dream journaling, and recovery analytics.',                tag:'HEALTH',  color:'#818cf8', path:'external/nicedreamzapp' },
  { id:'EXT-13', slug:'openclaw',             name:'OpenClaw',             desc:'AI agent execution environment — tool use, sandbox, and multi-agent coordination.',              tag:'AI',      color:'#e879f9', path:'external/openclaw' },
  { id:'EXT-14', slug:'OpenSpace',            name:'OpenSpace',            desc:'Real-time 3D space visualization — NASA data, planetary systems, and trajectories.',              tag:'SCIENCE', color:'#38bdf8', path:'external/OpenSpace' },
  { id:'EXT-15', slug:'OpenViking',           name:'OpenViking',           desc:'Decentralized autonomous agent swarm framework and coordination protocol.',                       tag:'AI',      color:'#fb923c', path:'external/OpenViking' },
  { id:'EXT-16', slug:'ruflo',                name:'Ruflo',                desc:'Real-time collaborative workflow platform with AI-assisted task orchestration.',                  tag:'WORKFLOW',color:'#c8fb4e', path:'external/ruflo' },
  { id:'EXT-17', slug:'the_well',             name:'The Well',             desc:'Massive physics simulation dataset — 15TB multi-physics ML training data.',                       tag:'DATA',    color:'#94a3b8', path:'external/the_well' },
  { id:'EXT-18', slug:'anime',                name:'Anime Project',        desc:'Anime media tooling and collection project.',                                                      tag:'MEDIA',   color:'#f472b6', path:'external/anime' },
  { id:'EXT-19', slug:'Cloud-aktuell-von-tj', name:'Cloud Aktuell (TJ)',   desc:'Current cloud architecture, Azure patterns, and reference materials from TJ collection.',         tag:'CLOUD',   color:'#38bdf8', path:'external/Cloud-aktuell-von-tj' },
];

// ── Reference Repos (references/ — educational / documentation) ──────────────
export interface ReferenceRepo { id:string; slug:string; name:string; desc:string; tag:string; color:string; path:string; }
export const REFERENCE_REPOS: ReferenceRepo[] = [
  { id:'REF-01', slug:'awesome-design-md',      name:'Awesome Design MD',      desc:'Curated design resources, UI/UX patterns, and design system references.',                     tag:'DESIGN',  color:'#f472b6', path:'references/awesome-design-md' },
  { id:'REF-02', slug:'build-your-own-x',       name:'Build Your Own X',       desc:'Step-by-step guides: build your own browser, OS, blockchain, git, game engine, and more.',   tag:'LEARNING',color:'#c8fb4e', path:'references/build-your-own-x' },
  { id:'REF-03', slug:'financial-services',     name:'Financial Services Ref', desc:'GitHub Copilot financial services — banking, trading, and compliance patterns.',              tag:'FINANCE', color:'#4ade80', path:'references/financial-services' },
  { id:'REF-04', slug:'free-programming-books', name:'Free Programming Books', desc:'3000+ free programming books in 40+ languages across all tech stacks — EBook Foundation.',   tag:'BOOKS',   color:'#fbbf24', path:'references/free-programming-books' },
  { id:'REF-05', slug:'project-based-learning', name:'Project-Based Learning', desc:'Curated tutorials for building real-world projects — web, ML, systems, mobile, databases.', tag:'LEARNING',color:'#00e5ff', path:'references/project-based-learning' },
  { id:'REF-06', slug:'public-apis',            name:'Public APIs Directory',  desc:'1400+ free public APIs — data, finance, weather, sports, maps, entertainment, and more.',   tag:'APIS',    color:'#818cf8', path:'references/public-apis' },
];

// ── Trading Resources (trading/ — strategies, indicators, tools) ─────────────
export interface TradingResource { id:string; slug:string; name:string; desc:string; path:string; }
export const TRADING_RESOURCES: TradingResource[] = [
  { id:'TR-01', slug:'entry-helper-indicator',      name:'Entry Helper Indicator',      desc:'Custom indicator code for precision entry signals and pattern confirmation.', path:'trading/entry helper indicator code.txt' },
  { id:'TR-02', slug:'maksymilian-8-sessions',      name:'Maksymilian 8 Sessions',      desc:'8-session framework — session structure, key levels, and directional bias.', path:'trading/maksymillian nadonly 8 sessions.txt' },
  { id:'TR-03', slug:'mig-liquidity-concepts',      name:'MIG Liquidity Concepts',      desc:'MIG liquidity sweep mechanics, Order Blocks, FVGs, and market structure.', path:'trading/mig lididity text aufklärung.txt' },
  { id:'TR-04', slug:'my-liquidity-edge-indicator', name:'My Liquidity Edge Indicator', desc:'Personal custom liquidity edge indicator — proprietary signal logic.', path:'trading/my indicator liqidity edge.txt' },
  { id:'TR-05', slug:'trading-websites',            name:'Trading Websites List',       desc:'Curated list of key trading platforms, data feeds, and tool websites.', path:'trading/trading internet seiten für trading.txt' },
];

export const SKILL_COLLECTIONS_COUNT = SKILL_COLLECTIONS.length;
export const EXTERNAL_PROJECTS_COUNT = EXTERNAL_PROJECTS.length;
export const REFERENCE_REPOS_COUNT   = REFERENCE_REPOS.length;
export const TRADING_RESOURCES_COUNT = TRADING_RESOURCES.length;
export const PROJECTS_TOTAL = SKILL_COLLECTIONS_COUNT + EXTERNAL_PROJECTS_COUNT + REFERENCE_REPOS_COUNT + TRADING_RESOURCES_COUNT;
