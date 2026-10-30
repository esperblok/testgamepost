# Geluidsdaemon voor FAKEVIRUS.
# Wacht op request-bestanden in %TEMP%\fakevirus_sounds\_req en speelt de bijbehorende
# .wav af met de SoundPlayer van Windows. Async afspelen betekent dat geluiden
# over elkaar heen kunnen lopen — dat is precies wat we willen.

$sounds = Join-Path $env:TEMP 'fakevirus_sounds'
$requests = Join-Path $sounds '_req'

while ($true) {
    if (Test-Path -LiteralPath $requests) {
        $files = Get-ChildItem -LiteralPath $requests -Filter *.txt -ErrorAction SilentlyContinue
        if ($files) {
            foreach ($file in $files) {
                $name = $null
                try {
                    $name = (Get-Content -LiteralPath $file.FullName -Raw -ErrorAction Stop) -replace '[\s\r\n]+', ''
                } catch {
                    $name = $null
                }

                if ($name) {
                    $wav = Join-Path $sounds ($name + '.wav')
                    if (Test-Path -LiteralPath $wav) {
                        try {
                            $player = New-Object System.Media.SoundPlayer -ArgumentList $wav
                            $player.Play()
                        } catch {
                            # Fallback: een oude façon voor als SoundPlayer beschikbaar is maar
                            # het bestand kan niet worden getransformeerd.
                            try {
                                [Console]::Beep(800, 60)
                            } catch { }
                        }
                    }
                }

                try { Remove-Item -LiteralPath $file.FullName -Force -ErrorAction SilentlyContinue } catch { }
            }
        }
    }

    Start-Sleep -Milliseconds 25
}
