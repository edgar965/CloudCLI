@echo off
rem ============================================================
rem CloudCLI fuer EIN Projektverzeichnis oeffnen.
rem
rem   cloudcli-projekt.cmd                          aktuelles Verzeichnis
rem   cloudcli-projekt.cmd "A:\projekt"             dieses Verzeichnis
rem   cloudcli-projekt.cmd "A:\projekt" --fragen    MIT Rueckfragen
rem   cloudcli-projekt.cmd . --name arbeit          eigener Fenstername
rem   cloudcli-projekt.cmd . --browser              statt Fenster im Browser
rem   cloudcli-projekt.cmd . --port 3011            anderer Port
rem   cloudcli-projekt.cmd . --nur-adresse          nur die Adresse zeigen
rem
rem Was passiert:
rem   Server        laeuft er schon auf dem Port, wird er mitbenutzt,
rem                 sonst ohne eigenes Fenster gestartet
rem   Anmeldung     Token wird lokal aus auth.db signiert (beispiele/token.cjs)
rem                 und als ?token=... an die Startadresse gehaengt -
rem                 es stehen KEINE Zugangsdaten in dieser Datei
rem   Startseite    /project/<url-kodierter Pfad>: die Oberflaeche waehlt
rem                 dieses Projekt aus und legt es an, falls unbekannt
rem   Fenstertitel  Name des Verzeichnisses (oder --name)
rem   Profil        %APPDATA%\CloudCLI-<Name>, damit mehrere Fenster
rem                 gleichzeitig offen sein koennen
rem
rem RUECKFRAGEN SIND HIER VORGABEMAESSIG AUS
rem   Das Fenster startet mit "Skip permissions": der Agent aendert Dateien
rem   und fuehrt Befehle aus, ohne vorher zu fragen - auch MCP-Werkzeuge wie
rem   der Chrome-Tab. Wer ein Verzeichnis oeffnet, das ihm nicht gehoert,
rem   haengt --fragen an; dann kommt der Bestaetigungsdialog wie gehabt.
rem   --bypass gibt es weiterhin, es ist jetzt nur noch die Vorgabe.
rem
rem   Technisch: die Startadresse bekommt ?bypass=1, src/startup/handover.js
rem   setzt daraufhin skipPermissions in claude-settings, opencode-settings
rem   und cursor-tools-settings des Profils.
rem ============================================================
setlocal EnableExtensions EnableDelayedExpansion

rem %~dp0 VOR der Argumentschleife sichern: "shift" verschiebt auch %0, danach
rem zeigt %~dp0 auf etwas anderes.
set "HIER=%~dp0"
set "QUELLE=%CLOUDCLI_QUELLE%"
if not defined QUELLE for %%q in ("%HIER%..") do set "QUELLE=%%~fq"

set "ZIEL="
set "NAME="
set "PORT=3010"
set "BYPASS=1"
set "BROWSER=0"
set "NURADRESSE=0"

:argumente
if "%~1"=="" goto :argumente_fertig
if /i "%~1"=="help"          goto :hilfe
if /i "%~1"=="--help"         goto :hilfe
if /i "%~1"=="-h"            goto :hilfe
if "%~1"=="/?"               goto :hilfe
if /i "%~1"=="--bypass"      ( set "BYPASS=1"      & shift & goto :argumente )
if /i "%~1"=="--fragen"      ( set "BYPASS=0"      & shift & goto :argumente )
if /i "%~1"=="--no-bypass"   ( set "BYPASS=0"      & shift & goto :argumente )
if /i "%~1"=="--browser"     ( set "BROWSER=1"     & shift & goto :argumente )
if /i "%~1"=="--nur-adresse" ( set "NURADRESSE=1"  & shift & goto :argumente )
if /i "%~1"=="--name"        ( set "NAME=%~2"      & shift & shift & goto :argumente )
if /i "%~1"=="--port"        ( set "PORT=%~2"      & shift & shift & goto :argumente )
if not defined ZIEL ( set "ZIEL=%~1" & shift & goto :argumente )
echo FEHLER: Unbekanntes Argument "%~1".
goto :abbruch

:argumente_fertig
if not defined ZIEL set "ZIEL=%CD%"
for %%d in ("%ZIEL%") do set "ZIEL=%%~fd"

if not exist "%ZIEL%\" (
    echo FEHLER: Verzeichnis nicht gefunden: "%ZIEL%"
    goto :abbruch
)

if not defined NAME for %%d in ("%ZIEL%") do set "NAME=%%~nxd"
if not defined NAME (
    echo FEHLER: Aus "%ZIEL%" laesst sich kein Name ableiten.
    goto :abbruch
)

if not exist "%QUELLE%\package.json" (
    echo FEHLER: CloudCLI nicht gefunden unter "%QUELLE%".
    echo         CLOUDCLI_QUELLE auf die Repo-Wurzel setzen.
    goto :abbruch
)

rem Pfad url-kodieren: "A:\projekt" wird "A%%3A%%5Cprojekt". EscapeDataString
rem kodiert auch : und \, die in einem Routenabschnitt sonst trennen wuerden.
set "PFAD="
for /f "delims=" %%u in ('powershell -NoProfile -Command "[uri]::EscapeDataString($env:ZIEL)"') do set "PFAD=%%u"
if not defined PFAD (
    echo FEHLER: Der Pfad liess sich nicht kodieren.
    goto :abbruch
)

rem Token holen. Ohne ihn kommt ein Login-Fenster - das ist kein Abbruchgrund.
set "TOKEN="
for /f "delims=" %%t in ('node "%HIER%token.cjs" --print') do set "TOKEN=%%t"

set "STARTPFAD=/project/%PFAD%"
if defined TOKEN set "STARTPFAD=%STARTPFAD%?token=%TOKEN%"
rem Kein Klammerblock hier: cmd liest das ^& in der Adresse sonst als
rem Befehlstrenner, auch in Anfuehrungszeichen.
if not "%BYPASS%"=="1" goto :adressefertig
if defined TOKEN set "STARTPFAD=%STARTPFAD%&bypass=1"
if not defined TOKEN set "STARTPFAD=%STARTPFAD%?bypass=1"
:adressefertig

rem Ausgabe mit verzoegerter Expansion, sonst zerlegt das ^& die Zeile.
if not "%NURADRESSE%"=="1" goto :serverpruefen
echo http://127.0.0.1:!PORT!!STARTPFAD!
goto :ende

:serverpruefen

rem ----- Server bereitstellen ----------------------------------
set "SYS=%SystemRoot%\System32"
"%SYS%\netstat.exe" -an | "%SYS%\find.exe" "127.0.0.1:%PORT%" | "%SYS%\find.exe" "LISTENING" >nul
if not errorlevel 1 (
    echo Server auf %PORT% laeuft schon - er wird mitbenutzt.
    goto :starten
)

echo Starte den Server auf 127.0.0.1:%PORT% ...
rem Kein "cd ... && npm" im Argument: das kaufmaennische Und laesst sich durch
rem cmd und PowerShell hindurch nicht zuverlaessig durchreichen.
set "SERVER_PORT=%PORT%"
set "HOST=127.0.0.1"
powershell -NoProfile -Command "Start-Process -FilePath cmd.exe -ArgumentList '/c','npm run server' -WorkingDirectory '%QUELLE%' -WindowStyle Hidden"

set /a VERSUCHE=0
:warten
set /a VERSUCHE+=1
"%SYS%\netstat.exe" -an | "%SYS%\find.exe" "127.0.0.1:%PORT%" | "%SYS%\find.exe" "LISTENING" >nul
if not errorlevel 1 goto :serverbereit
if %VERSUCHE% GEQ 30 (
    echo FEHLER: Server auf 127.0.0.1:%PORT% nicht bereit geworden.
    echo         Zum Nachsehen: "npm run server" in "%QUELLE%".
    goto :abbruch
)
"%SYS%\timeout.exe" /t 1 /nobreak >nul
goto :warten

:serverbereit
echo Server bereit.

:starten
if "%BROWSER%"=="1" (
    start "" "http://127.0.0.1:%PORT%%STARTPFAD%"
    goto :ende
)

if not exist "%QUELLE%\node_modules\electron\dist\electron.exe" (
    echo FEHLER: Electron fehlt. Einmal "npm install" in "%QUELLE%" laufen lassen.
    goto :abbruch
)

rem ELECTRON_RUN_AS_NODE leeren: aus einem VS-Code-Terminal ist die Variable
rem auf "1" geerbt, dann laeuft electron.exe als reines Node und main.js
rem bricht ab ("does not provide an export named 'safeStorage'").
set "ELECTRON_RUN_AS_NODE="
set "ELECTRON_NO_ATTACH_CONSOLE="

rem Eigenes Profil je Name: der Single-Instance-Lock haengt am
rem --user-data-dir, ohne eigenes Profil holt der zweite Start nur das erste
rem Fenster nach vorn. Der Name landet in einem Verzeichnisnamen, also keine
rem \ / : * ? " < > | darin.
set "PROFIL=%APPDATA%\CloudCLI-%NAME%"
set "CLOUDCLI_INSTANCE_NAME=%NAME%"
set "CLOUDCLI_DESKTOP_OPEN_LOCAL=1"
set "CLOUDCLI_DESKTOP_START_PATH=%STARTPFAD%"
set "CLOUDCLI_DESKTOP_LOCAL_SERVER_URL=http://127.0.0.1:%PORT%"

echo Fenster "%NAME%" fuer "%ZIEL%"
rem Ohne /wait: das Fenster laeuft eigenstaendig weiter, diese Datei ist fertig.
start "" "%QUELLE%\node_modules\electron\dist\electron.exe" "%QUELLE%\electron\main.js" --user-data-dir="%PROFIL%"
goto :ende

:hilfe
echo CloudCLI fuer ein Projektverzeichnis oeffnen.
echo.
echo   cloudcli-projekt.cmd [^<verzeichnis^>] [Optionen]
echo.
echo Ohne Verzeichnis wird das aktuelle genommen.
echo.
echo Optionen:
echo   --fragen          Rueckfragen vor Werkzeugaufrufen wieder einschalten.
echo                     Ohne diese Option laeuft das Fenster mit
echo                     "Skip permissions": der Agent aendert Dateien und
echo                     fuehrt Befehle aus, ohne zu fragen.
echo   --bypass          Vorgabe, ausdruecklich gesetzt (tut nichts extra).
echo   --name ^<name^>     Fenstername und Profil (Vorgabe: Verzeichnisname).
echo                     Zweimal derselbe Name heisst dasselbe Profil - das
echo                     zweite Fenster geht dann nicht auf.
echo   --port ^<port^>     Port des Servers (Vorgabe 3010).
echo   --browser         im Standardbrowser oeffnen statt als Fenster.
echo   --nur-adresse     nur die Startadresse ausgeben, nichts starten.
echo   help, --help      diese Hilfe.
echo.
echo Umgebung:
echo   CLOUDCLI_QUELLE     Repo-Wurzel (Vorgabe: Verzeichnis ueber dieser Datei)
echo   CLOUDCLI_TOKEN_TTL  Laufzeit des Tokens (Vorgabe: unbegrenzt)
echo.
echo Beispiele:
echo   cloudcli-projekt.cmd
echo   cloudcli-projekt.cmd "A:\projekt" --fragen
echo   cloudcli-projekt.cmd . --name arbeit --port 3011
endlocal
exit /b 0

:abbruch
echo.
echo Abgebrochen.
endlocal
exit /b 1

:ende
endlocal
