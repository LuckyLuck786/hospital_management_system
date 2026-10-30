#!/usr/bin/env python3
"""Regenerates docs/ER_DIAGRAM.md (from schema.prisma) and docs/PERMISSIONS_MATRIX.md (from @Roles decorators)."""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
BACKEND = ROOT / "apps" / "backend"

# ---------- ER diagram ----------
schema = (BACKEND / "prisma" / "schema.prisma").read_text()
models = dict(re.findall(r"^model (\w+) \{(.*?)^\}", schema, re.S | re.M))
enums = set(re.findall(r"^enum (\w+)", schema, re.M))
lines, rels = ["erDiagram"], []
for name, body in models.items():
    lines.append(f"  {name} {{")
    for raw in body.splitlines():
        raw = raw.strip()
        if not raw or raw.startswith(("//", "@@")):
            continue
        parts = raw.split()
        if len(parts) < 2:
            continue
        field, ftype = parts[0], parts[1]
        base = ftype.rstrip("?[]")
        if base in models:
            if "@relation(" in raw and "fields:" in raw:
                card = "|o" if ftype.endswith("?") else "||"
                rels.append(f'  {base} {card}--o{{ {name} : "{field}"')
            continue
        key = " PK" if "@id" in raw else (" FK" if field.endswith("Id") else "")
        mtype = base if base not in enums else "enum_" + base
        lines.append(f"    {mtype} {field}{key}")
    lines.append("  }")
# one-to-one relations (unique FK) are drawn as one-to-many; Mermaid keeps it readable.
er = "\n".join(lines + sorted(set(rels)))
(ROOT / "docs" / "ER_DIAGRAM.md").write_text(
    "# MedCore HMS — ER Diagram\n\nGenerated from `apps/backend/prisma/schema.prisma` by `scripts/gen-docs.py`. "
    f"{len(models)} models, {len(enums)} enums. Renders on GitHub.\n\n```mermaid\n{er}\n```\n"
)

# ---------- Permissions matrix ----------
ROLES = ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST", "LAB_TECHNICIAN", "PHARMACIST", "ACCOUNTANT", "PATIENT"]
SHORT = ["SA", "HA", "DOC", "NUR", "REC", "LAB", "PHA", "ACC", "PAT"]
rows = []
for ctrl in sorted((BACKEND / "src").rglob("*.controller.ts")):
    src = ctrl.read_text()
    consts = {k: re.findall(r"UserRole\.(\w+)", v) for k, v in re.findall(r"const (\w+)\s*=\s*\[(.*?)\]", src, re.S)}
    m = re.search(r"@Controller\('([^']*)'\)", src)
    prefix = m.group(1) if m else ""
    class_public = "@Public()" in src.split("export class")[0]
    body = src.split("export class", 1)[1]
    chunks = re.split(r"\n\s*async \w+\(", body)
    for i in range(len(chunks) - 1):
        prev = chunks[i]
        cut = max(prev.rfind("\n  }\n"), prev.find("{"))
        head = prev[cut:]
        hm = re.search(r"@(Get|Post|Patch|Put|Delete)\((?:'([^']*)')?\)", head)
        if not hm:
            continue
        verb, sub = hm.group(1).upper(), hm.group(2) or ""
        path = "/api/" + "/".join(p for p in [prefix, sub] if p)
        rm = re.search(r"@Roles\(([^@]*?)\)\s*\n", head, re.S)
        roles = None
        if rm:
            arg = rm.group(1)
            roles = set(re.findall(r"UserRole\.(\w+)", arg))
            for k, v in consts.items():
                if f"...{k}" in arg:
                    roles |= set(v)
        public = "@Public()" in head or class_public
        if public:
            cells = ["public"] + [""] * 8
        elif roles is None:
            cells = ["✓"] * 9
        else:
            cells = ["✓" if r in roles else "" for r in ROLES]
        rows.append(f"| `{verb} {path}` | " + " | ".join(cells) + " |")
hdr = "| Endpoint | " + " | ".join(SHORT) + " |\n|---|" + "---|" * len(SHORT)
(ROOT / "docs" / "PERMISSIONS_MATRIX.md").write_text(
    "# MedCore HMS — Permissions Matrix\n\n"
    "Generated from the `@Roles()` decorators by `scripts/gen-docs.py`, so it always matches the code.\n\n"
    "Legend: SA Super Admin, HA Hospital Admin, DOC Doctor, NUR Nurse, REC Receptionist, LAB Lab Technician, "
    "PHA Pharmacist, ACC Accountant, PAT Patient. ✓ = allowed by RolesGuard; `public` = no login.\n\n"
    "A ✓ for every role means any signed-in user passes the guard. Services then apply row-level rules "
    "(TenantGuard keeps everyone except SA inside their own hospital; patients only reach their own records; "
    "doctors only update their own encounters).\n\n" + hdr + "\n" + "\n".join(rows) + "\n"
)
print(f"ER: {len(models)} models; permissions: {len(rows)} endpoints")
