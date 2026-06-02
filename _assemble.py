#!/usr/bin/env python3
"""Assembler: combines part_a + part_b content, replaces Bloomberg block in TradingContent.tsx"""

import os

BASE = r"g:\main jarvis project og og og"
TARGET_FILE = os.path.join(BASE, r"src\screens\TradingContent.tsx")

# Read the current file
with open(TARGET_FILE, 'r', encoding='utf-8') as f:
    src = f.read()

# Read content parts
with open(os.path.join(BASE, "_part_a_content.txt"), 'r', encoding='utf-8') as f:
    part_a = f.read()

with open(os.path.join(BASE, "_part_b_content.txt"), 'r', encoding='utf-8') as f:
    part_b = f.read()

NEW_BLOCK = part_a + part_b

# Define exact boundary markers
REPLACE_FROM = '/* \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n   BLOOMBERG-STYLE TRADING TERMINAL'
REPLACE_TO   = '/* \u2500\u2500 Content module \u2014 AI-powered workflows'

if REPLACE_FROM not in src:
    print("ERROR: REPLACE_FROM marker not found!")
    # Try a search
    idx = src.find('BLOOMBERG-STYLE TRADING TERMINAL')
    if idx >= 0:
        print(f"Found 'BLOOMBERG-STYLE TRADING TERMINAL' at char offset {idx}")
        print("Context:", repr(src[max(0,idx-80):idx+60]))
    else:
        print("Not found at all. Searching for any ═ character...")
        idx2 = src.find('\u2550\u2550\u2550')
        print("═══ at:", idx2, repr(src[max(0,idx2-4):idx2+80]))
    exit(1)

if REPLACE_TO not in src:
    print("ERROR: REPLACE_TO marker not found!")
    idx = src.find('Content module')
    if idx >= 0:
        print(f"Found 'Content module' at char offset {idx}")
        print("Context:", repr(src[max(0,idx-60):idx+80]))
    exit(1)

idx_start = src.index(REPLACE_FROM)
idx_end   = src.index(REPLACE_TO)

if idx_start >= idx_end:
    print(f"ERROR: start ({idx_start}) >= end ({idx_end})")
    exit(1)

before = src[:idx_start]
after  = src[idx_end:]
new_src = before + NEW_BLOCK + after

print(f"Original: {len(src.splitlines())} lines")
print(f"Replaced block: {idx_start} to {idx_end} chars")
print(f"New block: {len(NEW_BLOCK.splitlines())} lines")
print(f"New total: {len(new_src.splitlines())} lines")

# Write result
with open(TARGET_FILE, 'w', encoding='utf-8') as f:
    f.write(new_src)

print("SUCCESS — wrote", TARGET_FILE)
