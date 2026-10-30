# FAKEVIRUS - scherp flashvenster (rode melding / zwart scherm).

param(
    [int]$Milliseconds = 450,
    [string]$Text = '',
    [string]$Color = 'Red'
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$rgb = [System.Drawing.Color]::Red
if ($Color -eq 'Black') { $rgb = [System.Drawing.Color]::Black }

$form = New-Object System.Windows.Forms.Form
$form.Text = 'FAKEVIRUS'
$form.FormBorderStyle = 'None'
$form.WindowState = 'Maximized'
$form.BackColor = $rgb
$form.TopMost = $true
[void]$form.Show()
$form.Refresh()

if ($Text) {
    $label = New-Object System.Windows.Forms.Label
    $label.Text = $Text
    $label.Location = New-Object System.Drawing.Point(0, 0)
    $label.AutoSize = $true
    $label.ForeColor = [System.Drawing.Color]::White
    $label.Font = New-Object System.Drawing.Font('Consolas', 36, [System.Drawing.FontStyle]::Bold)
    $form.Controls.Add($label)
    $form.Refresh()
}

Start-Sleep -Milliseconds ([Math]::Max(80, $Milliseconds))
$form.Close()
