param([ValidateSet('Start', 'Stop', 'Status')][string]$Action = 'Start')

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$StateDir = Join-Path $RepoRoot '.artifacts/mobile-remote'
$HarnessPidFile = Join-Path $StateDir 'harness.pid'
$TunnelPidFile = Join-Path $StateDir 'tunnel.pid'
$HarnessLog = Join-Path $StateDir 'harness.log'
$TunnelLog = Join-Path $StateDir 'tunnel.log'
$Port = 3080
$TunnelName = 'dsh-mobile.jpe1'
$TrustedHost = 'hqrvqnzd-3080.jpe1.devtunnels.ms'
$PublicUrl = 'https://' + $TrustedHost + '/'
$Node = (Get-Command node -ErrorAction Stop).Source
$DevTunnel = (Get-Command devtunnel -ErrorAction Stop).Source

function Read-Pid([string]$Path) {
  if (-not (Test-Path $Path)) { return $null }
  $value = (Get-Content -Raw $Path).Trim()
  if ($value -match '^\d+$') { return [int]$value }
  return $null
}

function Get-TrackedProcess([string]$Path) {
  $trackedPid = Read-Pid $Path
  if ($null -eq $trackedPid) { return $null }
  return Get-Process -Id $trackedPid -ErrorAction SilentlyContinue
}

function Stop-TrackedProcess([string]$Path, [string]$Label) {
  $process = Get-TrackedProcess $Path
  if ($null -ne $process) {
    Write-Host ('Stopping {0} (PID {1})...' -f $Label, $process.Id)
    Stop-Process -Id $process.Id -Force
  }
  Remove-Item $Path -Force -ErrorAction SilentlyContinue
}

function Show-Status {
  $harness = Get-TrackedProcess $HarnessPidFile
  $tunnel = Get-TrackedProcess $TunnelPidFile
  $harnessState = if ($null -ne $harness) { 'running (PID {0})' -f $harness.Id } else { 'stopped' }
  $tunnelState = if ($null -ne $tunnel) { 'running (PID {0})' -f $tunnel.Id } else { 'stopped' }
  Write-Host ('Harness: {0}' -f $harnessState)
  Write-Host ('Tunnel:  {0}' -f $tunnelState)
  Write-Host ('Local:   http://127.0.0.1:{0}/' -f $Port)
  Write-Host ('Public:  {0}' -f $PublicUrl)
}
