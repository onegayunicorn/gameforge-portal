# Builds build/icon.ico from the same hex geometry the portal uses (no external assets).
# Produces a multi-size PNG-compressed ICO (256/128/64/48/32/16) plus a 512px PNG.

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$buildDir = Join-Path $root 'build'
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

function New-HexPoints([double]$cx, [double]$cy, [double]$r) {
  $pts = @()
  for ($i = 0; $i -lt 6; $i++) {
    $a = ((-90 + ($i * 60)) * [Math]::PI) / 180
    $pts += New-Object System.Drawing.PointF(
      [float]($cx + $r * [Math]::Cos($a)),
      [float]($cy + $r * [Math]::Sin($a)))
  }
  return $pts
}

function New-MarkBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::Transparent)

  $s = $size / 512.0

  # rounded background tile with diagonal gradient
  $pad = 8 * $s
  $rect = New-Object System.Drawing.RectangleF($pad, $pad, ($size - 2 * $pad), ($size - 2 * $pad))
  $radius = 96 * $s
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $radius * 2
  $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
  $path.AddArc(($rect.Right - $d), $rect.Y, $d, $d, 270, 90)
  $path.AddArc(($rect.Right - $d), ($rect.Bottom - $d), $d, $d, 0, 90)
  $path.AddArc($rect.X, ($rect.Bottom - $d), $d, $d, 90, 90)
  $path.CloseFigure()

  $grad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $rect,
    [System.Drawing.Color]::FromArgb(255, 26, 36, 66),
    [System.Drawing.Color]::FromArgb(255, 10, 14, 28),
    55.0)
  $g.FillPath($grad, $path)

  # faint border
  $borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(90, 110, 168, 255), (3 * $s))
  $g.DrawPath($borderPen, $path)

  # outer hexagon (stroke)
  $outer = New-HexPoints (256 * $s) (256 * $s) (168 * $s)
  $hexPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(150, 110, 168, 255), (14 * $s))
  $hexPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $g.DrawPolygon($hexPen, $outer)

  # inner hexagon (filled) with its own gradient
  $inner = New-HexPoints (256 * $s) (256 * $s) (94 * $s)
  $innerPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $innerPath.AddPolygon($inner)
  $innerGrad = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.RectangleF((150 * $s), (140 * $s), (220 * $s), (230 * $s))),
    [System.Drawing.Color]::FromArgb(255, 138, 186, 255),
    [System.Drawing.Color]::FromArgb(255, 168, 130, 255),
    40.0)
  $g.FillPath($innerGrad, $innerPath)

  $g.Dispose()
  return $bmp
}

$sizes = @(256, 128, 64, 48, 32, 16)
$pngs = @()
foreach ($sz in $sizes) {
  $bmp = New-MarkBitmap $sz
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngs += , @{ size = $sz; bytes = $ms.ToArray() }
  $ms.Dispose()
  $bmp.Dispose()
}

# 512px PNG for documentation / store use
$big = New-MarkBitmap 512
$big.Save((Join-Path $buildDir 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$big.Dispose()

# --- assemble ICO (PNG-compressed entries, Windows Vista+) ---
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([UInt16]0)                 # reserved
$bw.Write([UInt16]1)                 # type: icon
$bw.Write([UInt16]$pngs.Count)       # image count

$offset = 6 + (16 * $pngs.Count)
foreach ($p in $pngs) {
  $dim = if ($p.size -ge 256) { 0 } else { $p.size }
  $bw.Write([Byte]$dim)              # width
  $bw.Write([Byte]$dim)              # height
  $bw.Write([Byte]0)                 # palette
  $bw.Write([Byte]0)                 # reserved
  $bw.Write([UInt16]1)               # planes
  $bw.Write([UInt16]32)              # bpp
  $bw.Write([UInt32]$p.bytes.Length) # payload size
  $bw.Write([UInt32]$offset)         # payload offset
  $offset += $p.bytes.Length
}
foreach ($p in $pngs) { $bw.Write($p.bytes) }
$bw.Flush()

$icoPath = Join-Path $buildDir 'icon.ico'
[System.IO.File]::WriteAllBytes($icoPath, $ms.ToArray())
$bw.Dispose(); $ms.Dispose()

$info = Get-Item $icoPath
"icon.ico written: {0} bytes ({1} sizes)" -f $info.Length, $pngs.Count
"icon.png written:  {0} bytes" -f (Get-Item (Join-Path $buildDir 'icon.png')).Length
