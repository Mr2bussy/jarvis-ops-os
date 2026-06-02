import pathlib, json

transcript_path = r'c:\Users\Administrator\AppData\Roaming\Code\User\workspaceStorage\2b030874e8027872f22566c8f56a10ae\GitHub.copilot-chat\transcripts\f9164de2-549d-4538-b612-3d123946f2e8.jsonl'
lines = pathlib.Path(transcript_path).read_text(encoding='utf-8', errors='ignore').splitlines()

keywords = ['ContentScreen', 'SOCIAL', 'PostingSchedule', 'CONTENT_TABS', 'PLATFORM', 'VIEWS', 'SUBS', 'FOLLOWERS', 'VIEWS_DATA']
found = []
for i, line in enumerate(lines):
    try:
        obj = json.loads(line)
        text = json.dumps(obj)
        for kw in keywords:
            if kw in text:
                found.append((i, kw, text[:600]))
                break
    except:
        pass

print(f"Total matches: {len(found)}")
for i, kw, preview in found[:30]:
    print(f"--- Line {i} kw={kw} ---")
    print(preview[:400])
    print()
