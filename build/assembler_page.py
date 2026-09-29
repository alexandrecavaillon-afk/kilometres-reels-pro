#!/usr/bin/env python3
"""Assemble index.html à partir de src/ (page, Leaflet, code). Usage : python build/assembler_page.py"""
import os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(R, "src", p), encoding="utf-8").read()
js = rd("leaflet.js").replace("//# sourceMappingURL=leaflet.js.map", "").rstrip()
app = '"use strict";\nconst $ = (s, r = document) => r.querySelector(s);\nconst $$ = (s, r = document) => Array.from(r.querySelectorAll(s));\n' + rd("import.js") + "\n" + rd("app.js") + "\n" + rd("verif.js") + "\n" + rd("coffre.js") + "\n" + rd("scenarios.js") + "\n" + rd("ia.js") + "\n" + rd("espace.js") + "\n" + rd("gsheet.js")
page = rd("page.html").replace("{{LEAFLET_CSS}}", rd("leaflet.css").rstrip()).replace("{{LEAFLET_JS}}", js).replace("{{APP_JS}}", app)
assert "</script" not in app
open(os.path.join(R, "index.html"), "w", encoding="utf-8").write(page)
print("index.html :", len(page.encode()), "octets")
