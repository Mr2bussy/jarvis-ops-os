import re

path = r"C:\Users\Administrator\Desktop\master jarvis app project oggg\electron\main.ts"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add node-cron import after the Anthropic import
old_import_line = "import Anthropic from '@anthropic-ai/sdk';"
new_import_line = "import Anthropic from '@anthropic-ai/sdk';\nimport * as cron from 'node-cron';"

assert old_import_line in content, "Anthropic import not found"
content = content.replace(old_import_line, new_import_line, 1)

# 2. Find end of file and add scheduler IPC before the last app.whenReady() / end section
# We'll add the scheduler section before the last closing block
# Find a good insertion point - right before "// app lifecycle"
marker = "app.on('before-quit'"
if marker not in content:
    # fallback: look for app lifecycle
    marker = "app.whenReady()"
    
idx = content.rfind(marker)
assert idx != -1, f"Marker not found: {marker}"

scheduler_code = """
// Workflow Scheduler (node-cron) ──────────────────────────────────────────
interface ScheduledJob {
  id: string;
  expression: string;
  workflowId: string;
  workflowName: string;
  prompt: string;
  channel: string;
  createdAt: number;
  lastRun?: number;
  runCount: number;
}
const scheduledJobs = new Map<string, { job: cron.ScheduledTask; meta: ScheduledJob }>();

ipcMain.handle('workflow:schedule', async (_evt, config: {
  id: string; expression: string; workflowId: string; workflowName: string;
  prompt: string; channel: string;
}) => {
  if (!cron.validate(config.expression)) throw new Error(`Invalid cron expression: ${config.expression}`);
  // Cancel existing job with same id
  if (scheduledJobs.has(config.id)) {
    scheduledJobs.get(config.id)!.job.stop();
    scheduledJobs.delete(config.id);
  }
  const meta: ScheduledJob = { ...config, createdAt: Date.now(), runCount: 0 };
  const task = cron.schedule(config.expression, async () => {
    meta.lastRun = Date.now();
    meta.runCount++;
    pushActivity('SCHEDULER', 'RUN', `${config.workflowName} · ${config.channel}`);
    try {
      const result = await routedComplete({
        messages: [{ role: 'user', content: config.prompt }],
        system: `You are JARVIS. Generate scheduled content for ${config.channel}. Be concise and platform-optimized.`,
        maxTokens: 800,
      });
      pushActivity('SCHEDULER', 'DONE', `${config.workflowName}: ${result.slice(0, 60)}`);
    } catch (e: any) {
      pushActivity('SCHEDULER', 'ERROR', String(e?.message || e).slice(0, 60));
    }
  }, { timezone: 'UTC' });
  scheduledJobs.set(config.id, { job: task, meta });
  return { ok: true, id: config.id };
});

ipcMain.handle('workflow:cancel', async (_evt, id: string) => {
  if (scheduledJobs.has(id)) {
    scheduledJobs.get(id)!.job.stop();
    scheduledJobs.delete(id);
    return true;
  }
  return false;
});

ipcMain.handle('workflow:list-scheduled', async () =>
  Array.from(scheduledJobs.values()).map(({ meta }) => meta)
);

"""

content = content[:idx] + scheduler_code + content[idx:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Done. File size: {len(content)}")
