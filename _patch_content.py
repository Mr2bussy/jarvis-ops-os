import re, sys

path = r"C:\Users\Administrator\Desktop\master jarvis app project oggg\src\screens\ContentModule.tsx"

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Change "import { useState } from 'react';" to add useEffect
old_import = "import { useState } from 'react';"
new_import = "import { useState, useEffect } from 'react';"
assert old_import in content, "Import not found"
content = content.replace(old_import, new_import, 1)

# 2. Rename static CONTENT_PIPELINE to DEFAULT_PIPELINE
old_pipeline_def = "const CONTENT_PIPELINE = ["
new_pipeline_def = "const DEFAULT_PIPELINE = ["
assert old_pipeline_def in content, "CONTENT_PIPELINE def not found"
content = content.replace(old_pipeline_def, new_pipeline_def, 1)

# 3. Rename static SCHEDULE_SLOTS to DEFAULT_SCHEDULE
old_sched_def = "const SCHEDULE_SLOTS = ["
new_sched_def = "const DEFAULT_SCHEDULE = ["
assert old_sched_def in content, "SCHEDULE_SLOTS def not found"
content = content.replace(old_sched_def, new_sched_def, 1)

# 4. In ContentScreen, add pipeline/schedule state after the first useState calls
# Find the first useState in ContentScreen
cs_start = content.index("export function ContentScreen({ onNav }: ScreenProps) {")
state_insert_point = content.index("  const [tab, setTab]", cs_start)

pipeline_state = """  // ── Persistent pipeline + schedule state ──────────────────────────────────
  const [pipeline, setPipeline] = useState<typeof DEFAULT_PIPELINE>(() => {
    try { const s = localStorage.getItem('jarvis.pipeline'); return s ? JSON.parse(s) : DEFAULT_PIPELINE; } catch { return DEFAULT_PIPELINE; }
  });
  const [schedSlots, setSchedSlots] = useState<typeof DEFAULT_SCHEDULE>(() => {
    try { const s = localStorage.getItem('jarvis.schedule'); return s ? JSON.parse(s) : DEFAULT_SCHEDULE; } catch { return DEFAULT_SCHEDULE; }
  });
  useEffect(() => { try { localStorage.setItem('jarvis.pipeline', JSON.stringify(pipeline)); } catch {} }, [pipeline]);
  useEffect(() => { try { localStorage.setItem('jarvis.schedule', JSON.stringify(schedSlots)); } catch {} }, [schedSlots]);
  const PIPELINE_STATUSES = ['QUEUED','DRAFTING','SCRIPTING','EDITING','RENDERING','DONE'] as const;
  function cyclePipelineStatus(id: string) {
    setPipeline(p => p.map(item => {
      if (item.id !== id) return item;
      const idx = PIPELINE_STATUSES.indexOf(item.status as any);
      return { ...item, status: PIPELINE_STATUSES[(idx + 1) % PIPELINE_STATUSES.length] };
    }));
  }
  const SCHED_STATUSES = ['queued','scheduled','live'] as const;
  function cycleSchedStatus(i: number) {
    setSchedSlots(s => s.map((sl, j) => {
      if (j !== i) return sl;
      const idx = SCHED_STATUSES.indexOf(sl.status as any);
      return { ...sl, status: SCHED_STATUSES[(idx + 1) % SCHED_STATUSES.length] };
    }));
  }
  """

content = content[:state_insert_point] + pipeline_state + content[state_insert_point:]

# 5. Replace CONTENT_PIPELINE.map( with pipeline.map(
content = content.replace("{CONTENT_PIPELINE.map((item, i) => (", "{pipeline.map((item, i) => (", 1)

# 6. Replace SCHEDULE_SLOTS.filter( with schedSlots.filter(
content = content.replace("const slots = SCHEDULE_SLOTS.filter(s => s.day === day", "const slots = schedSlots.filter(s => s.day === day", 1)

# 7. Add onClick to the pipeline row div and schedule slot div
# Pipeline row: replace the static div with a clickable one
old_pipeline_row = 'style={{ display: \'grid\', gridTemplateColumns: \'70px 38px 1fr 62px 60px\', alignItems: \'center\', padding: \'6px 0\', borderBottom: \'1px dashed var(--line-soft)\', gap: 0 }}>'
new_pipeline_row = 'style={{ display: \'grid\', gridTemplateColumns: \'70px 38px 1fr 62px 60px\', alignItems: \'center\', padding: \'6px 0\', borderBottom: \'1px dashed var(--line-soft)\', gap: 0, cursor: \'pointer\' }} onClick={() => cyclePipelineStatus(item.id)} title="Click to cycle status">'
if old_pipeline_row in content:
    content = content.replace(old_pipeline_row, new_pipeline_row, 1)
    print("Pipeline row onClick added")
else:
    print("WARNING: pipeline row not found for onClick")

# Schedule slot: replace with onClick
old_sched_slot = 'key={j} style={{\n                      padding: \'4px 5px\', background: sl.status === \'live\''
new_sched_slot = 'key={j} onClick={() => cycleSchedStatus(schedSlots.indexOf(sl))} style={{ cursor: \'pointer\',\n                      padding: \'4px 5px\', background: sl.status === \'live\''
if old_sched_slot in content:
    content = content.replace(old_sched_slot, new_sched_slot, 1)
    print("Schedule slot onClick added")
else:
    # Try simpler approach
    alt_old = "border: `1px solid ${sl.status === 'live' ? ROSE : sl.status === 'scheduled' ? JADE : 'var(--line-soft)'}40`,"
    if alt_old in content:
        print("Found alt schedule marker")
    else:
        print("WARNING: schedule slot div not found for onClick - skipping")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Done. File size: {len(content)}")
