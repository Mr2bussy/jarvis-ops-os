path = r"C:\Users\Administrator\Desktop\master jarvis app project oggg\src\screens\Agents.tsx"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the fake assignStatus function with a real last-used based version
old_assign = """function assignStatus(i: number): AgentEntry['status'] {
  const r = i % 7;
  if (r < 3) return 'online';
  if (r === 3) return 'busy';
  return 'standby';
}"""

new_assign = """const AGENT_LASTUSED_KEY = 'jarvis.agent-lastused';
function getAgentLastUsed(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(AGENT_LASTUSED_KEY) ?? '{}'); } catch { return {}; }
}
export function markAgentUsed(id: string) {
  const m = getAgentLastUsed();
  m[id] = Date.now();
  try { localStorage.setItem(AGENT_LASTUSED_KEY, JSON.stringify(m)); } catch {}
}
function assignStatus(id: string): AgentEntry['status'] {
  const lu = getAgentLastUsed()[id];
  if (!lu) return 'standby';
  const age = Date.now() - lu;
  if (age < 24 * 60 * 60 * 1000) return 'online';   // used within last 24h
  if (age < 7 * 24 * 60 * 60 * 1000) return 'busy';  // used within last 7 days
  return 'standby';
}"""

assert old_assign in content, f"assignStatus not found"
content = content.replace(old_assign, new_assign, 1)

# Fix the call site: assignStatus(i) -> assignStatus(r.id)
old_call = "status: assignStatus(i),"
new_call = "status: assignStatus(r.id),"
assert old_call in content, "assignStatus(i) call not found"
content = content.replace(old_call, new_call, 1)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Done. File size: {len(content)}")
