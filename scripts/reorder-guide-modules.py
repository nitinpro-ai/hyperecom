#!/usr/bin/env python3
"""Reorder COMPLETE-BUILD-GUIDE.md PART II into strict M01→M32 order
and add a module index. Run from repo root: python3 scripts/reorder-guide-modules.py"""
import re, sys

PATH = "docs/COMPLETE-BUILD-GUIDE.md"
lines = open(PATH, encoding="utf-8").read().split("\n")

part2_idx = next(i for i, l in enumerate(lines) if l.startswith("# PART II"))
part3_idx = next(i for i, l in enumerate(lines) if l.startswith("# PART III"))
head, part2, tail = lines[:part2_idx], lines[part2_idx:part3_idx], lines[part3_idx:]

first_m = next(i for i, l in enumerate(part2) if l.startswith("## M"))
intro = part2[:first_m]

secs, order = {}, []
cur, buf = None, []
for l in part2[first_m:]:
    if l.startswith("## "):
        if cur is not None:
            secs[cur] = buf
        cur, buf = l, [l]
        order.append(cur)
    else:
        buf.append(l)
secs[cur] = buf

dep = next((s for s in order if "dependency graph" in s), None)
modsecs = [s for s in order if s != dep]
modsecs.sort(key=lambda h: int(re.findall(r"M(\d\d)", h)[0]))

# Build the index table covering ALL 32 modules
rows = []
for s in modsecs:
    nums = re.findall(r"M(\d\d)", s)
    title = re.sub(r"^## M\d\d[^ —]*·?\s*", "", s).split(" (")[0].strip()
    # cleaner: strip leading module codes
    clean = re.sub(r"^## ", "", s)
    clean = re.sub(r"^((M\d\d[^—·]*)?[—·]\s*)+", "", clean).strip()
    for n in nums:
        rows.append((int(n), f"M{n}", clean, "grouped" if len(nums) > 1 else "own"))
rows.sort()
seen, index_rows = set(), []
for n, code, title, kind in rows:
    if code in seen:
        continue
    seen.add(code)
    index_rows.append(f"| {code} | {title} | {kind} section |")

index = [
    "## Module index — ALL 32 modules (M01–M32) in this part",
    "",
    "> Sections below are ordered **M01 → M32**. Foundation modules (M26 M27 M29 M30)",
    "> appear at their numeric positions but are **built first** — see the dependency",
    "> graph at the end of this part and PART III Steps 0–18 for build order.",
    "",
    "| Module | What it is | Where |",
    "|---|---|---|",
    *index_rows,
    "",
]

new_intro = [
    "# PART II — THE MODULES (M01–M32, complete build detail per module)",
    "",
    "> Module format: Purpose · Build info · Workflow · Tables (SQL) · APIs · Rules ·",
    "> Events · Screens · Acceptance. Sections are ordered M01→M32 (index below);",
    "> BUILD order differs — foundation modules first — see the dependency graph at",
    "> the end of this part and PART III.",
]

out_lines = head + new_intro + index + [l for s in modsecs for l in secs[s]]
if dep:
    out_lines += secs[dep]
out_lines += tail
open(PATH, "w", encoding="utf-8").write("\n".join(out_lines))
print(f"Reordered {len(modsecs)} module sections; index covers {len(index_rows)} modules")
