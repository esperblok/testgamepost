# FAKEVIRUS - flash van een nep Blue Screen of Death.
# Eén venster, maximaal, 2-3 seconden, dan weer weg. Kijk niet te lang.

param([int]$Seconds = 3)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Windows'
$form.FormBorderStyle = 'None'
$form.WindowState = 'Maximized'
$form.BackColor = [System.Drawing.Color]::FromArgb(0, 0, 170)
$form.TopMost = $true
[void]$form.Show()
$form.Refresh()

$lines = @(
    'A fatal exception 0E has occurred at 001A:F7F0A4B1.',
    'The current application will be terminated.',
    '',
    'Press any key to terminate the current application.',
    'If this is the first time you are seeing this screen,',
    'restart your computer. If this screen appears again,',
    'follow these steps:',
    '',
    '  1. Check for recent hardware or software changes.',
    '  2. Run a memory diagnostic on your system.',
    '  3. Disable BIOS memory options such as caching.',
    '',
    'Technical information:',
    '*** STOP: 0x0000000E (0xF7F0A4B1, 0xC0000001, 0xF7F0A4B1, 0x0)',
    '',
    '  Contact your system administrator for support.'
)

$y = 90
$font = New-Object System.Drawing.Font('Consolas', 15, [System.Drawing.FontStyle]::Bold)
foreach ($line in $lines) {
    $label = New-Object System.Windows.Forms.Label
    $label.Text = $line
    $label.Location = New-Object System.Drawing.Point(40, $y)
    $label.AutoSize = $true
    $label.ForeColor = [System.Drawing.Color]::White
    $label.Font = $font
    $form.Controls.Add($label)
    $y += 32
}

$form.Refresh()
Start-Sleep -Milliseconds ([Math]::Max(600, $Seconds * 1000))
$form.Close()
