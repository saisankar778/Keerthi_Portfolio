#!/usr/bin/env python3
"""Rebuild assets/logos.css from the SVGs in assets/logos/.

Each icon becomes a `.logo-<slug>` rule exposing a `--logo` custom property
holding a data URI. Masks that point at separate .svg files are blocked by
the file:// origin rules, so inlining keeps the site working whether it is
opened by double-click or served over http.

Icons come from Simple Icons (https://simpleicons.org), normalised to
monochrome. Add a new one with:

    curl -o assets/logos/<slug>.svg https://cdn.simpleicons.org/<slug>
    python3 tools/build-logos.py
"""
import glob, os, re
from urllib.parse import quote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

out = ["/* Generated from assets/logos/*.svg by tools/build-logos.py.",
       "   Inlined as data URIs so masks resolve under file:// as well as http://.",
       "   Do not edit by hand. */", ""]

for f in sorted(glob.glob('assets/logos/*.svg')):
    slug = os.path.splitext(os.path.basename(f))[0]
    svg = re.sub(r'\s+', ' ', open(f).read().strip()).replace('fill="currentColor" ', '')
    uri = quote(svg, safe="~()*!.'-_=:/,%[]{}#@;? ")
    out.append('.logo-%s { --logo: url("data:image/svg+xml,%s"); }' % (slug, uri))

open('assets/logos.css', 'w').write('\n'.join(out) + '\n')
print('assets/logos.css:', len(out) - 4, 'logos,', os.path.getsize('assets/logos.css') // 1024, 'KB')
