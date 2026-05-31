# Generates Windows icon (.ico) and NSIS installer bitmaps from
# logo.jpeg in this folder (which is a copy of the public/Hashmi Real
# Estate Builders.jpeg logo).
#
# Outputs (overwritten on every run):
#   - icon.ico            (multi-size 16/32/48/64/128/256 - app + shortcut icon)
#   - installerHeader.bmp (150 x 57   - NSIS top-right header)
#   - installerSidebar.bmp(164 x 314  - NSIS welcome/finish page sidebar)
#   - uninstallerSidebar.bmp (164 x 314)

Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$src = Join-Path $PSScriptRoot 'logo.jpeg'
if (-not (Test-Path $src)) {
    throw "Source logo not found at $src. Copy public/Hashmi Real Estate Builders.jpeg here as logo.jpeg first."
}

$source = [System.Drawing.Image]::FromFile($src)

function New-Square([System.Drawing.Image]$img, [int]$size, [System.Drawing.Color]$bg) {
    $bmp = New-Object System.Drawing.Bitmap($size, $size)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear($bg)

    # Aspect-preserved fit centered within the canvas with a 6% padding
    $pad = [int]($size * 0.06)
    $box = $size - 2 * $pad
    $scale = [Math]::Min($box / $img.Width, $box / $img.Height)
    $w = [int]($img.Width * $scale)
    $h = [int]($img.Height * $scale)
    $x = [int](($size - $w) / 2)
    $y = [int](($size - $h) / 2)
    $g.DrawImage($img, $x, $y, $w, $h)
    $g.Dispose()
    return $bmp
}

function New-Rect([System.Drawing.Image]$img, [int]$width, [int]$height, [System.Drawing.Color]$bg) {
    $bmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear($bg)

    $pad = [int]([Math]::Min($width, $height) * 0.06)
    $boxW = $width - 2 * $pad
    $boxH = $height - 2 * $pad
    $scale = [Math]::Min($boxW / $img.Width, $boxH / $img.Height)
    $w = [int]($img.Width * $scale)
    $h = [int]($img.Height * $scale)
    $x = [int](($width - $w) / 2)
    $y = [int](($height - $h) / 2)
    $g.DrawImage($img, $x, $y, $w, $h)
    $g.Dispose()
    return $bmp
}

# ------------ icon.ico ----------------------------------------------------
$sizes = @(16, 32, 48, 64, 128, 256)
$bg = [System.Drawing.Color]::White
$bmps = @()
foreach ($s in $sizes) { $bmps += , (New-Square -img $source -size $s -bg $bg) }

$out = Join-Path $PSScriptRoot 'icon.ico'
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]$bmps.Count)

$imgData = @()
$offset = 6 + 16 * $bmps.Count
foreach ($b in $bmps) {
    $tmp = New-Object System.IO.MemoryStream
    $b.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $tmp.ToArray()
    $tmp.Dispose()
    $w = if ($b.Width -ge 256) { 0 } else { $b.Width }
    $h = if ($b.Height -ge 256) { 0 } else { $b.Height }
    $bw.Write([byte]$w)
    $bw.Write([byte]$h)
    $bw.Write([byte]0)
    $bw.Write([byte]0)
    $bw.Write([UInt16]1)
    $bw.Write([UInt16]32)
    $bw.Write([UInt32]$bytes.Length)
    $bw.Write([UInt32]$offset)
    $offset += $bytes.Length
    $imgData += , $bytes
}
foreach ($d in $imgData) { $bw.Write($d) }
[System.IO.File]::WriteAllBytes($out, $ms.ToArray())
$ms.Dispose()
foreach ($b in $bmps) { $b.Dispose() }
Write-Host ('Wrote ' + (Get-Item $out).Length + ' bytes to ' + $out)

# ------------ NSIS bitmaps ------------------------------------------------
$headerBg = [System.Drawing.Color]::White
$sidebarBg = [System.Drawing.Color]::White

$header = New-Rect -img $source -width 150 -height 57 -bg $headerBg
$headerPath = Join-Path $PSScriptRoot 'installerHeader.bmp'
$header.Save($headerPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
$header.Dispose()
Write-Host "Wrote $headerPath"

$sidebar = New-Rect -img $source -width 164 -height 314 -bg $sidebarBg
$sidebarPath = Join-Path $PSScriptRoot 'installerSidebar.bmp'
$sidebar.Save($sidebarPath, [System.Drawing.Imaging.ImageFormat]::Bmp)
$sidebarPath2 = Join-Path $PSScriptRoot 'uninstallerSidebar.bmp'
$sidebar.Save($sidebarPath2, [System.Drawing.Imaging.ImageFormat]::Bmp)
$sidebar.Dispose()
Write-Host "Wrote $sidebarPath"
Write-Host "Wrote $sidebarPath2"

$source.Dispose()
