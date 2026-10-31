param([Parameter(ValueFromRemainingArguments=$true)][string[]]$PilotArgs)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$packingPython = $env:PACKING_PYTHON
if (-not $packingPython) {
    $packingPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
}
if (-not (Test-Path -LiteralPath $packingPython)) {
    throw 'Set PACKING_PYTHON to a Python 3.12 executable. Install requirements.txt into .deps first.'
}
Push-Location $repoRoot
try { & $packingPython (Join-Path $repoRoot 'run_pilot.py') @PilotArgs; if ($LASTEXITCODE -ne 0) { throw "Pilot exited $LASTEXITCODE" } }
finally { Pop-Location }
