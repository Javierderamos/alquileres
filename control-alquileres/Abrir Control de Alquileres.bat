@echo off
rem Abre la aplicacion en http://localhost:8765 (necesario para instalarla como aplicacion en Windows)
start "Control de Alquileres - servidor local" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor-local.ps1"
