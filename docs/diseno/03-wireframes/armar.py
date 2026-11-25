"""Incrusta _base.css en cada wireframe, entre /*BASE*/ y /*FIN-BASE*/.
El panel de vista previa abre los HTML sueltos y no resuelve hojas de estilo relativas.
Uso: python armar.py (desde esta carpeta)."""
import pathlib, re

aqui = pathlib.Path(__file__).parent
base = (aqui / "_base.css").read_text(encoding="utf-8")
for html in sorted(aqui.glob("*.html")):
    texto = html.read_text(encoding="utf-8")
    nuevo = re.sub(r"/\*BASE\*/.*?/\*FIN-BASE\*/", lambda _: "/*BASE*/\n" + base + "/*FIN-BASE*/", texto, flags=re.S)
    if nuevo != texto:
        html.write_text(nuevo, encoding="utf-8", newline="\n")
        print("actualizado", html.name)
