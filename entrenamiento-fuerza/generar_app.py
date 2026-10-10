"""Genera index.html (versión instalable para el móvil) a partir de retorno-fuerza.html.

retorno-fuerza.html es la fuente que se publica como artefacto en claude.ai, que añade
por su cuenta la cabecera HTML. Para alojar la aplicación en un servidor propio
(por ejemplo, GitHub Pages) hace falta esa cabecera, el manifiesto y el service worker.
Uso: python3 generar_app.py
"""
from pathlib import Path

base = Path(__file__).parent
fuente = (base / "retorno-fuerza.html").read_text(encoding="utf-8")
cabecera = """<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#1E4DB4">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Fuerza">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon-192.png">
<link rel="apple-touch-icon" href="icons/icon-192.png">
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
</head>
<body>
"""
pie = """
<script>if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});</script>
</body>
</html>
"""
(base / "index.html").write_text(cabecera + fuente + pie, encoding="utf-8")
print("index.html generado")
