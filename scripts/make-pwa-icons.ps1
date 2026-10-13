# Renders the PWA icon set from the shared hex mark geometry (no external assets).
# Output: pwa/icons/icon-{192,512}.png, maskable-{192,512}.png, apple-touch-icon-180.png,
#         favicon-{32,16}.png  (desktop build/icon.* is produced by make-icon.ps1)

param(
  [string]$OutDir
)

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
if (-not $OutDir) { $OutDir = Join-Path $root 'pwa\icons' }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Get-HexPointArray([double]$cx, [double]$cy, [double]$r) {
  $pts = @()
  for ($i = 0; $i -lt 6; $i++) {
    $a = ((-90 + ($i * 60)) * [Math]::PI) / 180
    $pts += New-Object System.Drawing.PointF(
      [float]($cx + $r * [Math]::Cos($a)),
      [float]($cy + $r * [Math]::Sin($a)))
  }
  return [System.Drawing.PointF[]]$pts
}

<#
  $contentScale < 1 pads the mark for the maskable safe zone (Android adaptive icons
  must keep their identity inside the central 80% circle).
#>
function New-MarkBitmap([int]$size, [double]$contentScale = 1.0, [bool]$rounded = $false) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  $s = $size / 512.0

  # full-bleed gradient field
  $field = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
  $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $field,
    [System.Drawing.Color]::FromArgb(255, 24, 33, 61),
    [System.Drawing.Color]::FromArgb(255, 9, 13, 26),
    55.0)

  if ($rounded) {
    $r = 96 * $s
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $r * 2
    $path.AddArc(0, 0, $d, $d, 180, 90)
    $path.AddArc(($size - $d), 0, $d, $d, 270, 90)
    $path.AddArc(($size - $d), ($size - $d), $d, $d, 0, 90)
    $path.AddArc(0, ($size - $d), $d, $d, 90, 90)
    $path.CloseFigure()
    $g.FillPath($bg, $path)
  } else {
    $g.FillRectangle($bg, $field)
  }

  $cx = $size / 2.0
  $cy = $size / 2.0

  # outer hexagon stroke
  $outer = Get-HexPointArray $cx $cy (150 * $s * $contentScale)
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(165, 110, 168, 255), ([Math]::Max(1.0, 12 * $s * $contentScale)))
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $g.DrawPolygon($pen, $outer)

  # inner hexagon fill
  $inner = Get-HexPointArray $cx $cy (84 * $s * $contentScale)
  $innerPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $innerPath.AddPolygon($inner)
  $half = 120 * $s * $contentScale
  $innerRect = New-Object System.Drawing.RectangleF(($cx - $half), ($cy - $half), ($half * 2), ($half * 2))
  $innerBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $innerRect,
    [System.Drawing.Color]::FromArgb(255, 138, 186, 255),
    [System.Drawing.Color]::FromArgb(255, 168, 130, 255),
    40.0)
  $g.FillPath($innerBrush, $innerPath)

  $g.Dispose()
  return $bmp
}

function Save-Icon([int]$size, [string]$name, [double]$scale = 1.0) {
  $bmp = New-MarkBitmap $size $scale $false
  $path = Join-Path $OutDir $name
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  return $path
}

$written = @()
$written += Save-Icon 192 'icon-192.png' 1.0
$written += Save-Icon 512 'icon-512.png' 1.0
$written += Save-Icon 192 'maskable-192.png' 0.66   # safe-zone padded
$written += Save-Icon 512 'maskable-512.png' 0.66
$written += Save-Icon 180 'apple-touch-icon-180.png' 1.0
$written += Save-Icon 32 'favicon-32.png' 1.0
$written += Save-Icon 16 'favicon-16.png' 1.0

foreach ($p in $written) {
  "{0,-32} {1,7} bytes" -f (Split-Path -Leaf $p), (Get-Item $p).Length
}
