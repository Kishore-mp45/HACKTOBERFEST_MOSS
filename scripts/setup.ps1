$ErrorActionPreference = "Stop"

function Require-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found. Install it and rerun this check."
    }
}

Require-Command "python"
Require-Command "node"
Require-Command "npm"
Require-Command "ollama"

$pythonVersion = python --version
$nodeVersion = node --version
Write-Host "Found $pythonVersion"
Write-Host "Found Node.js $nodeVersion"
Write-Host "Ollama is available. Checking the existing model inventory without pulling or running models..."

$modelList = ollama list
if ($LASTEXITCODE -ne 0) {
    throw "Could not read the Ollama model inventory."
}

foreach ($requiredTag in @("qwen3:4b", "nomic-embed-text:latest")) {
    if ($modelList -notmatch [regex]::Escape($requiredTag)) {
        Write-Warning "Expected existing Ollama tag '$requiredTag' was not listed. No model was downloaded."
    } else {
        Write-Host "Found existing model tag: $requiredTag"
    }
}

Write-Host "Prerequisite check complete. This script does not install packages or download models."
