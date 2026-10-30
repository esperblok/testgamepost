# FAKEVIRUS - fake lock-screen overlay.
# Draagt een tekstfile mee (standaard %TEMP%\fakevirus_overlays\ransom.txt).
# Dit venster is lokaal, op het scherm, en doet absoluut niets met de computer.

param(
    [string]$NoteFile = "$env:TEMP\fakevirus_overlays\ransom.txt",
    [int]$Width = 580,
    [int]$Height = 340
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$note = ''
if (Test-Path -LiteralPath $NoteFile) {
    $note = Get-Content -LiteralPath $NoteFile -Raw -ErrorAction SilentlyContinue
}
if (-not $note) {
    $note = "YOUR SYSTEM HAS BEEN LOCKED`r`n`r`nThis is a demonstration window."
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'FAKEVIRUS'
$form.BackColor = [System.Drawing.Color]::Black
$form.ForeColor = [System.Drawing.Color]::White
$form.FormBorderStyle = 'Sizable'
$form.StartPosition = 'CenterScreen'
$form.TopMost = $true
$form.Width = $Width
$form.Height = $Height
$form.Opacity = 0.97
$form.MinimumSize = New-Object System.Drawing.Size(420, 250)

$body = New-Object System.Windows.Forms.Label
$body.Text = $note
$body.Location = New-Object System.Drawing.Point(26, 22)
$body.Size = New-Object System.Drawing.Size([Math]::Max(140, $Width - 52), [Math]::Max(140, $Height - 118))
$body.ForeColor = [System.Drawing.Color]::White
$body.Font = New-Object System.Drawing.Font('Consolas', 10)
$body.TextAlign = 'TopLeft'
$body.AutoEllipsis = $false
$form.Controls.Add($body)

$footer = New-Object System.Windows.Forms.Label
$footer.Text = 'PRANK - your PC is untouched. Close this window to stop.'
$footer.Location = New-Object System.Drawing.Point(26, [Math]::Max(22, $Height - 46))
$footer.Size = New-Object System.Drawing.Size($Width - 52, 28)
$footer.ForeColor = [System.Drawing.Color]::FromArgb(120, 120, 120)
$footer.Font = New-Object System.Drawing.Font('Consolas', 8)
$form.Controls.Add($footer)

[void]$form.ShowDialog()
