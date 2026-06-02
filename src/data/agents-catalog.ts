// JARVIS Agent Catalog — 192 agents (including JARVIS life-category elite cells)
// Auto-curated by JARVIS OS v1.0

export type AgentCategory =
  | 'META'
  | 'CONTENT'
  | 'TRADING'
  | 'INFRA'
  | 'SECURITY'
  | 'FRONTEND'
  | 'BACKEND'
  | 'DATA'
  | 'CLOUD'
  | 'DEBUG'
  | 'SPECIALIST'
  | 'HEALTH'
  | 'FITNESS'
  | 'MIND'
  | 'SOCIAL'
  | 'LIFESTYLE';

export interface AgentEntry {
  id: string;
  name: string;
  desc: string;
  model: string;
  cat: AgentCategory;
  status: 'online' | 'standby' | 'busy';
}

export const AGENT_CATEGORIES: Record<AgentCategory, { label: string; color: string; icon: string }> = {
  META:       { label: 'META / ORCH',   color: 'violet',  icon: '◈' },
  CONTENT:    { label: 'CONTENT',       color: 'amber',   icon: '◇' },
  TRADING:    { label: 'TRADING',       color: 'jade',    icon: '◆' },
  INFRA:      { label: 'INFRA / DEVOPS',color: 'cyan',    icon: '◉' },
  SECURITY:   { label: 'SECURITY',      color: 'red',     icon: '◐' },
  FRONTEND:   { label: 'FRONTEND / UI', color: 'cyan',    icon: '◑' },
  BACKEND:    { label: 'BACKEND / CODE',color: 'violet',  icon: '○' },
  DATA:       { label: 'DATA / DB',     color: 'amber',   icon: '◎' },
  CLOUD:      { label: 'CLOUD / AZURE', color: 'cyan',    icon: '◌' },
  DEBUG:      { label: 'DEBUG / QA',    color: 'red',     icon: '◍' },
  SPECIALIST: { label: 'SPECIALIST',    color: 'jade',    icon: '◯' },
  HEALTH:     { label: 'HEALTH · MED',  color: 'jade',    icon: '⬡' },
  FITNESS:    { label: 'FITNESS · ATH', color: 'cyan',    icon: '⬢' },
  MIND:       { label: 'MIND · COGN',   color: 'violet',  icon: '◭' },
  SOCIAL:     { label: 'SOCIAL · NET',  color: 'amber',   icon: '◬' },
  LIFESTYLE:  { label: 'LIFESTYLE',     color: 'cyan',    icon: '◮' },
};

export const AGENTS: AgentEntry[] = [
  // ── META / ORCHESTRATION ─────────────────────────────────────────────────
  { id: 'AG-001', name: '4.1 Beast Mode v3.1',        desc: 'GPT 4.1 top-notch autonomous coding agent, runs until fully resolved.',          model: 'GPT-4.1',         cat: 'META',      status: 'online'  },
  { id: 'AG-002', name: 'Blueprint Mode',              desc: 'Structured workflows (Debug/Express/Main/Loop) with strict correctness.',         model: 'GPT-5',           cat: 'META',      status: 'online'  },
  { id: 'AG-003', name: 'Blueprint Mode Codex',        desc: 'Minimal tool policy, never assumes facts, reproducible solutions.',               model: 'GPT-5-Codex',     cat: 'META',      status: 'standby' },
  { id: 'AG-004', name: 'GPT-5 Beast Mode',            desc: 'Powerful autonomous agent for GPT-5; conducts research, iterates to resolution.', model: 'GPT-5',           cat: 'META',      status: 'online'  },
  { id: 'AG-005', name: 'Thinking Beast Mode',         desc: 'Transcendent coding agent with quantum cognitive architecture.',                   model: 'GPT-4.1',         cat: 'META',      status: 'standby' },
  { id: 'AG-006', name: 'Ultimate Transparent Thinking', desc: 'Full reasoning transparency with unrestricted creative freedom.',               model: 'GPT-4.1',         cat: 'META',      status: 'standby' },
  { id: 'AG-007', name: 'gem-orchestrator',            desc: 'Coordinates multi-agent workflows, delegates tasks, synthesizes results.',        model: 'GPT-4.1',         cat: 'META',      status: 'online'  },
  { id: 'AG-008', name: 'gem-planner',                 desc: 'DAG-based plans with pre-mortem analysis and task decomposition.',                 model: 'GPT-4.1',         cat: 'META',      status: 'online'  },
  { id: 'AG-009', name: 'gem-researcher',              desc: 'Research specialist: gathers codebase context and structured findings.',           model: 'GPT-4.1',         cat: 'META',      status: 'busy'    },
  { id: 'AG-010', name: 'gem-implementer',             desc: 'Executes TDD code changes, ensures verification, maintains quality.',              model: 'GPT-4.1',         cat: 'META',      status: 'busy'    },
  { id: 'AG-011', name: 'RUG',                         desc: 'Pure orchestration — decomposes requests, delegates all work, repeats till done.', model: 'GPT-4.1',         cat: 'META',      status: 'online'  },
  { id: 'AG-012', name: 'Context Architect',           desc: 'Plans and executes multi-file changes by identifying context and dependencies.',   model: 'GPT-5',           cat: 'META',      status: 'online'  },
  { id: 'AG-013', name: 'Meta Agentic Scaffold',       desc: 'Meta agentic project creation for managing multi-agent project workflows.',        model: 'GPT-4.1',         cat: 'META',      status: 'standby' },
  { id: 'AG-014', name: 'custom-agent-foundry',        desc: 'Expert at designing and creating VS Code custom agents with optimal configs.',     model: 'Claude Sonnet 4.5', cat: 'META',    status: 'online'  },
  { id: 'AG-015', name: 'voidBeast Enhanced 1.0',      desc: 'Elite full-stack dev agent: Plan/Act/Deep Research/Analyzer/Memory modes.',       model: 'GPT-4.1',         cat: 'META',      status: 'online'  },
  { id: 'AG-016', name: 'Modernization Agent',         desc: 'Human-in-the-loop modernization for analysis, documentation, and architecture.',  model: 'GPT-5',           cat: 'META',      status: 'standby' },
  { id: 'AG-017', name: 'Critical Thinking Mode',      desc: 'Challenges assumptions to ensure best possible solution and outcomes.',            model: 'GPT-4.1',         cat: 'META',      status: 'online'  },
  { id: 'AG-018', name: 'agent-instructions v5',       desc: 'Advanced Autonomous Coding Agent V5.0 — Fusion Protocol.',                        model: 'GPT-4.1',         cat: 'META',      status: 'online'  },
  { id: 'AG-019', name: 'Repo Architect Agent',        desc: 'Bootstraps and validates agentic project structures for Copilot and OpenCode.',   model: 'GPT-4.1',         cat: 'META',      status: 'standby' },
  { id: 'AG-020', name: 'APC-I Manager Team',          desc: 'Expert team for Agent Prompts, Chatmodes & Instructions Management with WPF GUI.',model: 'GPT-4.1',         cat: 'META',      status: 'standby' },

  // ── CONTENT / SOCIAL MEDIA ───────────────────────────────────────────────
  { id: 'AG-021', name: 'Social Media Automation',    desc: 'Vollautomatischer Content-Upload für Instagram, YouTube, TikTok.',                model: 'GPT-4.1',         cat: 'CONTENT',   status: 'busy'    },
  { id: 'AG-022', name: 'Social Media JSON Workflow', desc: 'n8n JSON workflow analysis for AI-supported social media content generation.',     model: 'GPT-4.1',         cat: 'CONTENT',   status: 'online'  },
  { id: 'AG-023', name: 'reepl-linkedin',              desc: 'LinkedIn content creation, scheduling, and analytics with Copilot integration.',  model: 'GPT-4.1',         cat: 'CONTENT',   status: 'online'  },
  { id: 'AG-024', name: 'SE: Tech Writer',             desc: 'Technical writing specialist for developer docs, tutorials, and blogs.',           model: 'GPT-5',           cat: 'CONTENT',   status: 'online'  },
  { id: 'AG-025', name: 'Lyrics Generator',            desc: 'AI-powered lyrics creation and composition assistance.',                           model: 'GPT-4.1',         cat: 'CONTENT',   status: 'standby' },
  { id: 'AG-026', name: 'Technical Content Evaluator',desc: 'Elite technical content editor and curriculum architect for training materials.',   model: 'Claude Sonnet 4.5', cat: 'CONTENT', status: 'online'  },
  { id: 'AG-027', name: 'gem-documentation-writer',   desc: 'Generates technical docs, diagrams, maintains code-documentation parity.',         model: 'GPT-4.1',         cat: 'CONTENT',   status: 'busy'    },
  { id: 'AG-028', name: 'Create PRD',                  desc: 'Generates comprehensive PRDs with user stories, acceptance criteria, and metrics.', model: 'GPT-4.1',         cat: 'CONTENT',   status: 'online'  },
  { id: 'AG-029', name: 'Specification Agent',         desc: 'Generate or update specification documents for new or existing functionality.',    model: 'GPT-4.1',         cat: 'CONTENT',   status: 'standby' },
  { id: 'AG-030', name: 'Prompt Engineer',             desc: 'Analyzes and improves prompts against systematic framework with reasoning.',       model: 'GPT-4.1',         cat: 'CONTENT',   status: 'online'  },
  { id: 'AG-031', name: 'Prompt Builder',              desc: 'Expert prompt engineering and validation — by microsoft/edge-ai.',                 model: 'GPT-4.1',         cat: 'CONTENT',   status: 'standby' },
  { id: 'AG-032', name: 'SE: Product Manager',         desc: 'GitHub issues, business-value alignment, and data-driven product decisions.',      model: 'GPT-5',           cat: 'CONTENT',   status: 'online'  },
  { id: 'AG-033', name: 'Idea Generator',              desc: 'Brainstorms new application ideas through interactive discovery until spec-ready.', model: 'GPT-4.1',         cat: 'CONTENT',   status: 'standby' },
  { id: 'AG-034', name: 'Atlassian Requirements → Jira',desc: 'Transforms requirement docs into structured Jira epics with duplicate detection.',model: 'GPT-4.1',         cat: 'CONTENT',   status: 'standby' },
  { id: 'AG-035', name: 'Demonstrate Understanding',  desc: 'Validates user understanding of code via guided questioning.',                      model: 'GPT-4.1',         cat: 'CONTENT',   status: 'standby' },
  { id: 'AG-036', name: 'Mentor Mode',                 desc: 'Mentors the engineer with guidance, support, and working code.',                   model: 'GPT-4.1',         cat: 'CONTENT',   status: 'online'  },
  { id: 'AG-037', name: 'Search & AI Optimization',   desc: 'SEO, AEO, and GEO expert with AI-ready content strategies.',                       model: 'GPT-4.1',         cat: 'CONTENT',   status: 'standby' },

  // ── TRADING ──────────────────────────────────────────────────────────────
  { id: 'AG-038', name: 'XAUZaxco Institutional Trading', desc: 'Elite 7-role institutional trading team. Gold strategies, ML models, MT5 execution, walk-forward validation.', model: 'GPT-4.1', cat: 'TRADING', status: 'busy' },

  // ── INFRA / DEVOPS ───────────────────────────────────────────────────────
  { id: 'AG-039', name: 'DevOps Expert',               desc: 'Infinity loop DevOps (Plan→Code→Build→Test→Release→Deploy→Operate→Monitor).',     model: 'GPT-4.1',         cat: 'INFRA',     status: 'online'  },
  { id: 'AG-040', name: 'GitHub Actions Expert',       desc: 'Secure CI/CD workflows, action pinning, OIDC auth, least-privilege permissions.',  model: 'GPT-4.1',         cat: 'INFRA',     status: 'online'  },
  { id: 'AG-041', name: 'gem-devops',                  desc: 'Manages containers, CI/CD pipelines, and infrastructure deployment.',               model: 'GPT-4.1',         cat: 'INFRA',     status: 'online'  },
  { id: 'AG-042', name: 'Platform SRE for Kubernetes', desc: 'SRE specialist: reliability, safe rollouts/rollbacks, security defaults.',          model: 'GPT-4.1',         cat: 'INFRA',     status: 'busy'    },
  { id: 'AG-043', name: 'SE: DevOps/CI',               desc: 'CI/CD pipelines, deployment debugging, and GitOps — deployments boring & reliable.', model: 'GPT-5',          cat: 'INFRA',     status: 'online'  },
  { id: 'AG-044', name: 'terraform.agent',             desc: 'Terraform specialist: HCP Terraform workflows, registry integration, workspace mgmt.', model: 'GPT-4.1',      cat: 'INFRA',     status: 'standby' },
  { id: 'AG-045', name: 'Terraform IaC Reviewer',      desc: 'Safer IaC changes with state safety, least privilege, drift detection.',            model: 'GPT-4.1',         cat: 'INFRA',     status: 'standby' },
  { id: 'AG-046', name: 'Azure Terraform Planning',    desc: 'Implementation planner for Azure Terraform IaC tasks.',                             model: 'GPT-4.1',         cat: 'INFRA',     status: 'standby' },
  { id: 'AG-047', name: 'Azure Terraform Specialist',  desc: 'Azure Terraform IaC coding specialist — creates and reviews Terraform for Azure.',  model: 'GPT-4.1',         cat: 'INFRA',     status: 'standby' },
  { id: 'AG-048', name: 'pagerduty-incident-responder',desc: 'Responds to PagerDuty incidents, identifies code changes, suggests fixes via PRs.', model: 'GPT-4.1',         cat: 'INFRA',     status: 'standby' },
  { id: 'AG-049', name: 'stackhawk-security-onboarding',desc: 'Sets up StackHawk security testing with generated config and GitHub Actions.',    model: 'GPT-4.1',         cat: 'INFRA',     status: 'standby' },
  { id: 'AG-050', name: 'dynatrace-expert',            desc: 'Observability and security in GitHub: incidents, deployments, traces, logs.',       model: 'GPT-4.1',         cat: 'INFRA',     status: 'online'  },
  { id: 'AG-051', name: 'neon-migration-specialist',   desc: 'Zero-downtime Postgres migrations using Neon branching workflow.',                  model: 'GPT-4.1',         cat: 'INFRA',     status: 'standby' },
  { id: 'AG-052', name: 'neon-optimization-analyzer',  desc: 'Finds and fixes slow Postgres queries with isolated branch testing.',              model: 'GPT-4.1',         cat: 'INFRA',     status: 'standby' },
  { id: 'AG-053', name: 'octopus-deploy-release-notes',desc: 'Generates release notes for Octopus Deploy releases via MCP APIs.',               model: 'GPT-4.1',         cat: 'INFRA',     status: 'standby' },
  { id: 'AG-054', name: 'arm-migration',               desc: 'Arm Cloud Migration: scans for architecture issues, drives multi-arch containers.', model: 'GPT-4.1',         cat: 'INFRA',     status: 'standby' },
  { id: 'AG-055', name: 'droid.agent',                 desc: 'Droid CLI guidance — exec commands for CI/CD and non-interactive automation.',      model: 'Claude Sonnet 4.5', cat: 'INFRA',   status: 'standby' },

  // ── SECURITY ─────────────────────────────────────────────────────────────
  { id: 'AG-056', name: 'SE: Security',                desc: 'OWASP Top 10, Zero Trust, LLM security, enterprise code review specialist.',        model: 'GPT-5',           cat: 'SECURITY',  status: 'online'  },
  { id: 'AG-057', name: 'SE: Responsible AI',          desc: 'Bias prevention, accessibility compliance, ethical AI, and inclusive design.',      model: 'GPT-5',           cat: 'SECURITY',  status: 'online'  },
  { id: 'AG-058', name: 'gem-reviewer',                desc: 'Security gatekeeper — OWASP, secrets, compliance for critical tasks.',              model: 'GPT-4.1',         cat: 'SECURITY',  status: 'online'  },
  { id: 'AG-059', name: 'jfrog-sec',                   desc: 'Application security: verifies package compliance and suggests vulnerability fixes.', model: 'GPT-4.1',        cat: 'SECURITY',  status: 'busy'    },
  { id: 'AG-060', name: 'WG Code Sentinel',            desc: 'Reviews code for security issues with comprehensive vulnerability analysis.',        model: 'GPT-4.1',         cat: 'SECURITY',  status: 'online'  },
  { id: 'AG-061', name: 'WG Code Alchemist',           desc: 'Transforms code with Clean Code principles and SOLID design patterns.',             model: 'GPT-4.1',         cat: 'SECURITY',  status: 'online'  },
  { id: 'AG-062', name: 'Devils Advocate',             desc: 'Challenges every assumption — plays the devil\'s advocate on all proposals.',       model: 'GPT-4.1',         cat: 'SECURITY',  status: 'standby' },

  // ── FRONTEND / UI ────────────────────────────────────────────────────────
  { id: 'AG-063', name: 'Expert React Frontend Engineer', desc: 'React 19.2: hooks, Server Components, Actions, TypeScript, performance.',       model: 'GPT-4.1',         cat: 'FRONTEND',  status: 'busy'    },
  { id: 'AG-064', name: 'Next.js Expert',              desc: 'Next.js 16 App Router, Server Components, Cache, Turbopack, modern React.',         model: 'GPT-4.1',         cat: 'FRONTEND',  status: 'online'  },
  { id: 'AG-065', name: 'AEM Front-End Specialist',    desc: 'AEM components with HTL, Tailwind CSS, Figma-to-code workflows.',                   model: 'GPT-4.1',         cat: 'FRONTEND',  status: 'standby' },
  { id: 'AG-066', name: 'cyberpunk-c-gui-team',        desc: 'Elite 15-agent team — SHADOW ARCHITECT for C GUI, reverse engineering, covert apps.', model: 'GPT-4.1',       cat: 'FRONTEND',  status: 'online'  },
  { id: 'AG-067', name: 'liquid-glass-c-gui-expert',   desc: 'Elite C GUI team with Liquid Glass design, Content Creator themes, self-learning.', model: 'GPT-4.1',         cat: 'FRONTEND',  status: 'online'  },
  { id: 'AG-068', name: 'gem-browser-tester',          desc: 'Automates browser testing, UI/UX validation with visual verification.',             model: 'GPT-4.1',         cat: 'FRONTEND',  status: 'standby' },
  { id: 'AG-069', name: 'html-structured',             desc: 'Clean semantic HTML with proper structure and accessibility.',                       model: 'GPT-4.1',         cat: 'FRONTEND',  status: 'standby' },
  { id: 'AG-070', name: 'Playwright Tester Mode',      desc: 'End-to-end testing mode specialized for Playwright frameworks.',                    model: 'Claude Sonnet 4', cat: 'FRONTEND',  status: 'standby' },
  { id: 'AG-071', name: 'Accessibility Expert',        desc: 'WCAG 2.1/2.2 compliance, inclusive UX, and a11y testing specialist.',              model: 'GPT-4.1',         cat: 'FRONTEND',  status: 'online'  },
  { id: 'AG-072', name: 'PowerShell-GUI-Team',         desc: 'Expert team for PowerShell 7 GUI development with WPF, XAML components.',          model: 'GPT-4.1',         cat: 'FRONTEND',  status: 'standby' },
  { id: 'AG-073', name: 'SE: UX Designer',             desc: 'Jobs-to-be-Done analysis, user journey mapping, UX research for Figma.',           model: 'GPT-5',           cat: 'FRONTEND',  status: 'online'  },
  { id: 'AG-074', name: 'VS Code Tour Expert',         desc: 'Creates and maintains VSCode CodeTour files with comprehensive schema support.',    model: 'GPT-4.1',         cat: 'FRONTEND',  status: 'standby' },
  { id: 'AG-075', name: 'Electron Code Review',        desc: 'Code review for Electron apps: Node.js main, Angular renderer, native layer.',     model: 'GPT-4.1',         cat: 'FRONTEND',  status: 'online'  },

  // ── BACKEND / CODE ───────────────────────────────────────────────────────
  { id: 'AG-076', name: 'C# Expert',                   desc: 'Expert .NET software engineering for production-grade C# projects.',                model: 'GPT-4.1',         cat: 'BACKEND',   status: 'online'  },
  { id: 'AG-077', name: 'C#/.NET Janitor',             desc: 'Janitorial cleanup, modernization, and tech debt remediation for .NET.',            model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-078', name: 'Universal Janitor',           desc: 'Janitorial tasks for any codebase: cleanup, simplification, debt removal.',         model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-079', name: 'Principal Software Engineer', desc: 'Principal-level guidance: engineering excellence, technical leadership.',           model: 'GPT-4.1',         cat: 'BACKEND',   status: 'online'  },
  { id: 'AG-080', name: 'SWE',                         desc: 'Senior software engineer for feature development, debugging, refactoring, testing.', model: 'GPT-4.1',        cat: 'BACKEND',   status: 'busy'    },
  { id: 'AG-081', name: 'SE: Architect',               desc: 'System architecture review: Well-Architected frameworks, AI and distributed systems.', model: 'GPT-5',        cat: 'BACKEND',   status: 'online'  },
  { id: 'AG-082', name: 'Software Engineer Agent',     desc: 'Expert-level delivery of production-ready, maintainable, spec-driven code.',         model: 'GPT-4.1',        cat: 'BACKEND',   status: 'online'  },
  { id: 'AG-083', name: 'Expert .NET Engineer',        desc: 'Expert .NET guidance using modern software design patterns.',                        model: 'GPT-4.1',         cat: 'BACKEND',   status: 'online'  },
  { id: 'AG-084', name: '.NET Upgrade',                desc: 'C#/.NET code modernization, cleanup, and tech debt remediation.',                   model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-085', name: 'Polyglot Test Generator',     desc: 'Orchestrates test generation using Research-Plan-Implement pipeline.',               model: 'GPT-4.1',        cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-086', name: 'Polyglot Test Researcher',    desc: 'Analyzes codebases: structure, testing patterns, build commands, frameworks.',       model: 'GPT-4.1',        cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-087', name: 'Polyglot Test Planner',       desc: 'Creates structured test plans from research — organized by priority and complexity.', model: 'GPT-4.1',       cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-088', name: 'Polyglot Test Implementer',   desc: 'Implements single test phase, writes files, verifies compile and pass.',             model: 'GPT-4.1',        cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-089', name: 'Polyglot Test Builder',       desc: 'Runs build/compile commands and reports results for any language.',                  model: 'GPT-4.1',        cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-090', name: 'Polyglot Test Fixer',         desc: 'Fixes compilation errors in source or test files from error messages.',              model: 'GPT-4.1',        cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-091', name: 'Polyglot Test Linter',        desc: 'Runs code formatting/linting and discovers lint command from project files.',        model: 'GPT-4.1',        cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-092', name: 'Polyglot Test Tester',        desc: 'Runs test commands and reports results — discovers test command automatically.',      model: 'GPT-4.1',        cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-093', name: 'TDD Red Phase',               desc: 'Guide test-first: writes failing tests from GitHub issues before implementation.',   model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-094', name: 'TDD Green Phase',             desc: 'Implements minimal code to satisfy requirements and make failing tests pass.',        model: 'GPT-4.1',        cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-095', name: 'TDD Refactor Phase',          desc: 'Improves quality, applies security best practices while keeping tests green.',        model: 'GPT-4.1',        cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-096', name: 'Rust Beast Mode',             desc: 'Rust GPT-4.1 Coding Beast Mode for VS Code — idiomatic, safe Rust.',                 model: 'GPT-4.1',        cat: 'BACKEND',   status: 'online'  },
  { id: 'AG-097', name: 'dotnet-debug-team',           desc: 'Combined expert team for .NET debugging, cleanup, and code quality.',                model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-098', name: 'Drupal Expert',               desc: 'Drupal development, architecture, and best practices with PHP 8.3+ patterns.',       model: 'GPT-4.1',        cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-099', name: 'Laravel Expert',              desc: 'Laravel 12+ with Eloquent, Artisan, testing, and best practices.',                   model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-100', name: 'Shopify Expert',              desc: 'Shopify theme development, Liquid templating, app development, APIs.',               model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-101', name: 'PHP MCP Expert',              desc: 'PHP MCP server development using the official SDK with attribute-based discovery.',  model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-102', name: 'Pimcore Expert',              desc: 'Pimcore CMS, DAM, PIM, and E-Commerce with Symfony integration.',                   model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-103', name: 'Go MCP Expert',               desc: 'Model Context Protocol servers in Go using the official SDK.',                       model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-104', name: 'Kotlin MCP Expert',           desc: 'MCP servers in Kotlin using the official SDK.',                                      model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-105', name: 'Swift MCP Expert',            desc: 'MCP servers in Swift with modern concurrency and official MCP Swift SDK.',           model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-106', name: 'Ruby MCP Expert',             desc: 'MCP servers in Ruby using official MCP Ruby SDK gem with Rails integration.',        model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-107', name: 'TypeScript MCP Expert',       desc: 'MCP servers in TypeScript — comprehensive tooling and types.',                       model: 'GPT-4.1',         cat: 'BACKEND',   status: 'online'  },
  { id: 'AG-108', name: 'Python MCP Expert',           desc: 'MCP servers in Python — full protocol, tools, resources, prompts.',                  model: 'GPT-4.1',         cat: 'BACKEND',   status: 'online'  },
  { id: 'AG-109', name: 'Java MCP Expert',             desc: 'MCP servers in Java using reactive streams, official SDK, Spring Boot.',             model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-110', name: 'C# MCP Expert',               desc: 'Model Context Protocol servers in C# — full protocol implementation.',               model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-111', name: 'Rust MCP Expert',             desc: 'Rust MCP server using rmcp SDK with tokio async runtime.',                           model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-112', name: 'Clojure Interactive Programming', desc: 'Clojure pair programmer with REPL-first methodology and architectural oversight.', model: 'GPT-4.1',      cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-113', name: 'Semantic Kernel .NET',        desc: 'Create, update, refactor code using .NET version of Semantic Kernel.',               model: 'Claude Sonnet 4', cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-114', name: 'Semantic Kernel Python',      desc: 'Create, update, refactor code using Python version of Semantic Kernel.',             model: 'Claude Sonnet 4', cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-115', name: 'Microsoft Agent .NET',        desc: 'Work with Microsoft Agent Framework .NET version.',                                  model: 'Claude Sonnet 4', cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-116', name: 'Microsoft Agent Python',      desc: 'Work with Microsoft Agent Framework Python version.',                                model: 'Claude Sonnet 4', cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-117', name: 'C++ Expert',                  desc: 'Expert C++ software engineering guidance using modern C++ and industry best practices.', model: 'GPT-4.1',    cat: 'BACKEND',   status: 'online'  },
  { id: 'AG-118', name: 'Salesforce Expert',           desc: 'Salesforce Platform: Apex Enterprise Patterns, LWC, integration, Aura-to-LWC.',     model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-119', name: 'API Architect',               desc: 'API architecture guidance, mentorship, and working code for engineers.',             model: 'GPT-4.1',         cat: 'BACKEND',   status: 'online'  },
  { id: 'AG-120', name: 'OpenAPI to App Generator',    desc: 'Generates working applications from OpenAPI specifications.',                        model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-121', name: 'dotnet-maui',                 desc: 'Cross-platform .NET MAUI apps with controls, XAML, handlers, performance.',         model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-122', name: 'WinForms Expert',             desc: 'OOP .NET WinForms Designer compatible app development.',                             model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-123', name: 'express Expert',              desc: 'Latest Express.js versions, best practices, correct syntax using live docs.',        model: 'GPT-4.1',         cat: 'BACKEND',   status: 'online'  },
  { id: 'AG-124', name: 'John (JSON Master)',           desc: 'Million-Dollar Dev with JSON mastery, multi-language expertise, CODEX autonomy.',   model: 'GPT-4.1',         cat: 'BACKEND',   status: 'online'  },
  { id: 'AG-125', name: 'arch.agent',                  desc: 'Modern architecture patterns, NFR requirements, architectural diagrams.',            model: 'GPT-4.1',         cat: 'BACKEND',   status: 'online'  },
  { id: 'AG-126', name: 'Plan Mode — Strategic',       desc: 'Strategic planning and architecture before implementation — deep analysis.',         model: 'GPT-4.1',         cat: 'BACKEND',   status: 'online'  },
  { id: 'AG-127', name: 'Implementation Plan Mode',    desc: 'Generates implementation plans for new features or refactoring.',                   model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-128', name: 'Technical Spike Research',    desc: 'Systematically validates technical spikes through exhaustive investigation.',       model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-129', name: 'Technical Debt Plan',         desc: 'Generates technical debt remediation plans for code, tests, and documentation.',    model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-130', name: 'Refine Requirement',          desc: 'Refines requirements with Acceptance Criteria, Edge Cases, and NFRs.',              model: 'GPT-4.1',         cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-131', name: 'adr-generator',               desc: 'Comprehensive Architectural Decision Records with structured AI-optimized formatting.', model: 'GPT-4.1',    cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-132', name: 'apify-integration-expert',    desc: 'Apify Actors integration: selection, workflow, implementation, production deploy.',  model: 'GPT-4.1',        cat: 'BACKEND',   status: 'standby' },
  { id: 'AG-133', name: 'Universal PR Comment Addresser', desc: 'Addresses PR comments systematically with production-quality fixes.',           model: 'GPT-4.1',         cat: 'BACKEND',   status: 'online'  },

  // ── DATA / DATABASE ──────────────────────────────────────────────────────
  { id: 'AG-134', name: 'Kusto Assistant',             desc: 'Expert KQL assistant for Azure Data Explorer analysis via Azure MCP.',               model: 'GPT-4.1',        cat: 'DATA',      status: 'online'  },
  { id: 'AG-135', name: 'MS-SQL DBA',                  desc: 'Microsoft SQL Server administration using the MS SQL extension.',                   model: 'GPT-4.1',         cat: 'DATA',      status: 'online'  },
  { id: 'AG-136', name: 'PostgreSQL DBA',              desc: 'PostgreSQL administration using the PostgreSQL extension.',                          model: 'GPT-4.1',         cat: 'DATA',      status: 'online'  },
  { id: 'AG-137', name: 'Power BI Data Modeling',      desc: 'Star schema, relationship design, Microsoft best practices for optimal performance.', model: 'GPT-4.1',       cat: 'DATA',      status: 'standby' },
  { id: 'AG-138', name: 'Power BI DAX Expert',         desc: 'DAX formulas for performance, readability, and maintainability.',                   model: 'GPT-4.1',         cat: 'DATA',      status: 'standby' },
  { id: 'AG-139', name: 'Power BI Performance Expert', desc: 'Troubleshooting, monitoring, and improving Power BI model performance.',            model: 'GPT-4.1',         cat: 'DATA',      status: 'standby' },
  { id: 'AG-140', name: 'Power BI Visualization Expert', desc: 'Report design and visualization using Microsoft best practices.',                 model: 'GPT-4.1',         cat: 'DATA',      status: 'standby' },
  { id: 'AG-141', name: 'mongodb-performance-advisor',  desc: 'MongoDB query and index optimization with actionable performance recommendations.', model: 'GPT-4.1',       cat: 'DATA',      status: 'standby' },
  { id: 'AG-142', name: 'neo4j-python-codegen',        desc: 'Python Neo4j client library generation from GitHub issues with best practices.',    model: 'GPT-4.1',         cat: 'DATA',      status: 'standby' },
  { id: 'AG-143', name: 'comet-opik',                  desc: 'Comet Opik: LLM instrumentation, prompts, projects, traces, metrics via MCP.',      model: 'GPT-4.1',        cat: 'DATA',      status: 'online'  },
  { id: 'AG-144', name: 'api-gateway (Elastic)',        desc: 'Debugging (O11y), vector search (RAG), security threats using Elastic data.',       model: 'GPT-4.1',        cat: 'DATA',      status: 'online'  },

  // ── CLOUD / AZURE ────────────────────────────────────────────────────────
  { id: 'AG-145', name: 'Azure Principal Architect',   desc: 'Well-Architected Framework guidance and Microsoft best practices.',                 model: 'GPT-4.1',         cat: 'CLOUD',     status: 'online'  },
  { id: 'AG-146', name: 'Azure SaaS Architect',        desc: 'Multitenant SaaS applications using Azure Well-Architected SaaS principles.',      model: 'GPT-4.1',         cat: 'CLOUD',     status: 'online'  },
  { id: 'AG-147', name: 'Azure Logic Apps Expert',     desc: 'Workflow design, integration patterns, JSON Workflow Definition Language.',          model: 'GPT-4.1',        cat: 'CLOUD',     status: 'standby' },
  { id: 'AG-148', name: 'Azure AVM Bicep',             desc: 'Create, update, review Azure IaC in Bicep using Azure Verified Modules.',           model: 'GPT-4.1',         cat: 'CLOUD',     status: 'standby' },
  { id: 'AG-149', name: 'Azure AVM Terraform',         desc: 'Create, update, review Azure IaC in Terraform using Azure Verified Modules.',       model: 'GPT-4.1',         cat: 'CLOUD',     status: 'standby' },
  { id: 'AG-150', name: 'azure-iac-generator',         desc: 'Central hub for generating Bicep, ARM, Terraform, Pulumi IaC templates.',           model: 'Claude Sonnet 4.5', cat: 'CLOUD',  status: 'online'  },
  { id: 'AG-151', name: 'azure-iac-exporter',          desc: 'Exports existing Azure resources to IaC templates via Resource Graph.',             model: 'Claude Sonnet 4.5', cat: 'CLOUD',  status: 'standby' },
  { id: 'AG-152', name: 'Bicep Specialist',            desc: 'Azure Bicep IaC coding specialist — creates comprehensive Bicep templates.',         model: 'GPT-4.1',        cat: 'CLOUD',     status: 'standby' },
  { id: 'AG-153', name: 'Bicep Planning',              desc: 'Implementation planner for Azure Bicep IaC tasks.',                                 model: 'GPT-4.1',         cat: 'CLOUD',     status: 'standby' },
  { id: 'AG-154', name: 'Power Platform Expert',       desc: 'Code Apps, canvas apps, Dataverse, connectors, Power Platform best practices.',     model: 'GPT-4.1',         cat: 'CLOUD',     status: 'standby' },
  { id: 'AG-155', name: 'Power Platform MCP Expert',   desc: 'Power Platform custom connectors with MCP integration for Copilot Studio.',         model: 'GPT-4.1',        cat: 'CLOUD',     status: 'standby' },
  { id: 'AG-156', name: 'MCP M365 Agent Expert',       desc: 'MCP-based declarative agents for Microsoft 365 Copilot.',                           model: 'GPT-4.1',         cat: 'CLOUD',     status: 'standby' },
  { id: 'AG-157', name: 'Declarative Agents Architect',desc: 'Architect for declarative agent systems and coordination patterns.',                 model: 'GPT-4.1',         cat: 'CLOUD',     status: 'standby' },
  { id: 'AG-158', name: 'Microsoft Study & Learn',     desc: 'Personal Microsoft/Azure tutor — learns through guided discovery, not answers.',    model: 'GPT-4.1',         cat: 'CLOUD',     status: 'online'  },
  { id: 'AG-159', name: 'Microsoft Learn Contributor', desc: 'Edits Microsoft Learn docs following MS Writing Style Guide.',                      model: 'GPT-4.1',         cat: 'CLOUD',     status: 'standby' },
  { id: 'AG-160', name: 'Fedora Linux Expert',         desc: 'Fedora (Red Hat family): dnf, SELinux, and modern systemd-based workflows.',         model: 'GPT-5',          cat: 'CLOUD',     status: 'online'  },
  { id: 'AG-161', name: 'Arch Linux Expert',           desc: 'Arch Linux: pacman, rolling-release maintenance, Arch-centric system administration.', model: 'GPT-5',        cat: 'CLOUD',     status: 'standby' },
  { id: 'AG-162', name: 'CentOS Linux Expert',         desc: 'RHEL-compatible administration, yum/dnf workflows, enterprise hardening.',          model: 'GPT-4.1',         cat: 'CLOUD',     status: 'standby' },
  { id: 'AG-163', name: 'Debian Linux Expert',         desc: 'Debian stable administration, apt-based package management, Debian policy.',        model: 'Claude Sonnet 4', cat: 'CLOUD',     status: 'online'  },

  // ── DEBUG / QA ───────────────────────────────────────────────────────────
  { id: 'AG-164', name: 'Debug Mode',                  desc: 'Debug your application to find and fix bugs systematically.',                        model: 'GPT-4.1',        cat: 'DEBUG',     status: 'online'  },
  { id: 'AG-165', name: 'QA',                          desc: 'Meticulous QA subagent for test planning, bug hunting, edge-case analysis.',        model: 'GPT-4.1',         cat: 'DEBUG',     status: 'busy'    },
  { id: 'AG-166', name: 'Comprehensive Debug Validator',desc: 'Comprehensive validation and debugging across stack layers.',                       model: 'GPT-4.1',         cat: 'DEBUG',     status: 'online'  },
  { id: 'AG-167', name: 'dotnet-fix-team',             desc: '.NET Debug & Fix Team — debugging, cleanup, and code quality.',                     model: 'GPT-4.1',         cat: 'DEBUG',     status: 'standby' },
  { id: 'AG-168', name: 'Gilfoyle Code Review',        desc: 'Sardonic code review with technical elitism. Brutal honesty about your code.',      model: 'GPT-4.1',         cat: 'DEBUG',     status: 'online'  },
  { id: 'AG-169', name: 'High-Level Big Picture Architect', desc: 'High-level architectural documentation and review of legacy systems.',         model: 'Claude Sonnet 4', cat: 'DEBUG',     status: 'online'  },
  { id: 'AG-170', name: 'app-navigation-repair',       desc: 'Diagnoses and repairs app navigation issues across frameworks.',                    model: 'GPT-4.1',         cat: 'DEBUG',     status: 'standby' },

  // ── SPECIALIST ───────────────────────────────────────────────────────────
  { id: 'AG-171', name: 'amplitude-experiment',        desc: 'Deploys Amplitude experiments via MCP: variant testing, feature rollout.',          model: 'GPT-4.1',         cat: 'SPECIALIST',status: 'standby' },
  { id: 'AG-172', name: 'CAST Imaging Impact Analysis',desc: 'Change impact assessment and risk analysis using CAST Imaging.',                   model: 'GPT-4.1',         cat: 'SPECIALIST',status: 'standby' },
  { id: 'AG-173', name: 'CAST Software Discovery',     desc: 'Application discovery and architectural mapping via static code analysis.',         model: 'GPT-4.1',         cat: 'SPECIALIST',status: 'standby' },
  { id: 'AG-174', name: 'CAST Structural Quality',     desc: 'Code quality issues identification and remediation using CAST Imaging.',            model: 'GPT-4.1',         cat: 'SPECIALIST',status: 'standby' },
  { id: 'AG-175', name: 'monday-bug-fixer',            desc: 'Bug-fixing agent enriched with Monday.com context: items, docs, comments, epics.', model: 'GPT-4.1',         cat: 'SPECIALIST',status: 'standby' },
  { id: 'AG-176', name: 'lingodotdev-i18n',            desc: 'Internationalization (i18n) in web apps using checklist-driven approach.',          model: 'GPT-4.1',         cat: 'SPECIALIST',status: 'standby' },
  { id: 'AG-177', name: 'launchdarkly-cleanup',        desc: 'LaunchDarkly feature flag cleanup and lifecycle management.',                       model: 'GPT-4.1',         cat: 'SPECIALIST',status: 'standby' },
  { id: 'AG-178', name: 'diffblue-cover',              desc: 'Creates unit tests for Java applications using Diffblue Cover.',                    model: 'GPT-4.1',         cat: 'SPECIALIST',status: 'standby' },
  { id: 'AG-179', name: 'VS Code Insiders A11y Tracker', desc: 'Tracks and analyzes accessibility improvements in VS Code Insiders builds.',     model: 'Claude Sonnet 4.5', cat: 'SPECIALIST', status: 'online'  },
  { id: 'AG-180', name: 'Task Planner',                desc: 'Creates actionable implementation plans — by microsoft/edge-ai.',                  model: 'Claude Sonnet 4', cat: 'SPECIALIST',status: 'online'  },
  { id: 'AG-181', name: 'Task Researcher',             desc: 'Comprehensive project analysis and research specialist — by microsoft/edge-ai.',    model: 'GPT-4.1',         cat: 'SPECIALIST',status: 'online'  },
  { id: 'AG-182', name: 'SyncManager Expert Team',     desc: 'Expert team for PowerShell SyncManager: modern UI, complex sync logic.',           model: 'GPT-4.1',         cat: 'SPECIALIST',status: 'standby' },
  { id: 'AG-183', name: 'Python Sync Expert Team',     desc: 'Specialized team for Python application sync — full features, production-ready.',   model: 'GPT-4.1',        cat: 'SPECIALIST',status: 'standby' },
  { id: 'AG-184', name: 'megaagent-team',              desc: 'Ultra-scale multi-agent team for complex cross-domain operations.',                 model: 'GPT-4.1',         cat: 'SPECIALIST',status: 'online'  },
  { id: 'AG-185', name: 'opencode-development-team',   desc: 'Coordinated team for OpenCode CLI-based development workflows.',                    model: 'GPT-4.1',         cat: 'SPECIALIST',status: 'standby' },
  { id: 'AG-186', name: 'QA',                          desc: 'Meticulous QA for test planning, bug hunting, and implementation verification.',    model: 'GPT-4.1',         cat: 'SPECIALIST',status: 'standby' },
  { id: 'AG-187', name: 'Polyglot Test Full Suite',    desc: 'Complete test suite orchestration across all polyglot components.',                 model: 'GPT-4.1',         cat: 'SPECIALIST',status: 'standby' },

  // ── JARVIS LIFE CATEGORIES — ELITE CELLS ─────────────────────────────────
  { id: 'AG-188', name: 'DR-PRIME · Chief Medical Officer', desc: 'Elite CMO cell: full-body diagnostics, HRV, bloodwork AI, sleep architecture, longevity protocols. Peter Attia level.', model: 'Claude Sonnet 4.5', cat: 'HEALTH',    status: 'live' as any },
  { id: 'AG-189', name: 'HERCULES · Athletic Performance', desc: 'Olympic-level S&C director: periodized programming, biomechanics, VO2max, recovery protocols. Strength + endurance.',   model: 'Claude Sonnet 4.5', cat: 'FITNESS',   status: 'live' as any },
  { id: 'AG-190', name: 'SYGMA · Performance Psychology',  desc: 'Elite sport psychologist + learning engineer: deep work protocols, focus scoring, stress architecture, spaced repetition.', model: 'Claude Sonnet 4.5', cat: 'MIND',      status: 'live' as any },
  { id: 'AG-191', name: 'NEXUS · Network Intelligence',    desc: 'Relationship strategist: contact decay detection, depth scoring, Cialdini-based communication coaching, status positioning.', model: 'Claude Sonnet 4.5', cat: 'SOCIAL',    status: 'live' as any },
  { id: 'AG-192', name: 'RHYTHM · Lifestyle Architect',    desc: 'Elite lifestyle director: ritual design, environment optimization, identity curation, travel logistics, 21-day streak tracker.', model: 'Claude Sonnet 4.5', cat: 'LIFESTYLE', status: 'live' as any },
];

export const AGENT_COUNT = AGENTS.length; // 187

export const AGENTS_BY_CAT = AGENTS.reduce((acc, a) => {
  if (!acc[a.cat]) acc[a.cat] = [];
  acc[a.cat].push(a);
  return acc;
}, {} as Record<AgentCategory, AgentEntry[]>);

/** Live activity events for the ticker feed */
export const AGENT_EVENTS: { who: string; action: string; target: string }[] = [
  { who: 'gem-orchestrator',       action: 'DISPATCHING',  target: 'MO-Δ7 Phase 3' },
  { who: 'social-media-automation',action: 'UPLOADING',    target: 'YouTube · Draft 003' },
  { who: 'XAUZaxco Trading Team',  action: 'ANALYZING',    target: 'XAU/USD — Asian Range' },
  { who: 'DevOps Expert',          action: 'RUNNING',      target: 'CI/CD pipeline · main' },
  { who: 'gem-researcher',         action: 'SCANNING',     target: 'codebase context' },
  { who: 'Context Architect',      action: 'MAPPING',      target: 'dependency graph' },
  { who: 'GitHub Actions Expert',  action: 'PATCHING',     target: 'OIDC workflow v2' },
  { who: 'SE: Security',           action: 'AUDITING',     target: 'OWASP Top 10 sweep' },
  { who: 'reepl-linkedin',         action: 'SCHEDULING',   target: 'post × 3 — 14:00' },
  { who: 'gem-planner',            action: 'BUILDING',     target: 'DAG plan · 12 nodes' },
  { who: 'Platform SRE',           action: 'MONITORING',   target: 'k8s cluster health' },
  { who: 'QA',                     action: 'TESTING',      target: 'edge cases · suite B' },
  { who: 'Thinking Beast Mode',    action: 'REASONING',    target: 'adversarial analysis' },
  { who: 'C# Expert',              action: 'REVIEWING',    target: 'PR #447 · auth module' },
  { who: '4.1 Beast Mode',         action: 'RESOLVING',    target: 'task queue — 4 items' },
  { who: 'gem-implementer',        action: 'WRITING',      target: 'TDD green phase · 7 tests' },
  { who: 'azure-iac-generator',    action: 'GENERATING',   target: 'Bicep template · prod' },
  { who: 'Expert React Engineer',  action: 'OPTIMIZING',   target: 'render perf · 60fps' },
  { who: 'jfrog-sec',              action: 'SCANNING',     target: 'CVE sweep · 214 pkgs' },
  { who: 'RUG',                    action: 'ORCHESTRATING',target: 'workflow · 8 subagents' },
  { who: 'technical-content-eval', action: 'EVALUATING',   target: 'curriculum · module 5' },
  { who: 'dynatrace-expert',       action: 'TRACING',      target: 'incident INC-2847' },
  { who: 'Principal SWE',          action: 'ARCHITECTING', target: 'system design · v3' },
  { who: 'Rust Beast Mode',        action: 'COMPILING',    target: 'zero-copy parser' },
  { who: 'social-media-json',      action: 'BUILDING',     target: 'n8n workflow · IG loop' },
  { who: 'gem-reviewer',           action: 'APPROVING',    target: 'security gate · pass' },
  { who: 'Polyglot Test Gen',      action: 'GENERATING',   target: '42 test cases · rust' },
  { who: 'WG Code Sentinel',       action: 'SCANNING',     target: 'secrets sweep · clean' },
  { who: 'WG Code Alchemist',      action: 'REFACTORING',  target: 'SOLID patterns · 6 files' },
  { who: 'mongoDB advisor',        action: 'OPTIMIZING',   target: 'query index · 40ms→4ms' },
];
