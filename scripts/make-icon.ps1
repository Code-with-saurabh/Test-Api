Add-Type -AssemblyName System.Drawing

$dir = "resources"
New-Item -ItemType Directory -Path $dir -Force | Out-Null

function New-IconBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.PixelOffsetMode = 'HighQuality'

  $scale = $size / 256.0

  # background rounded rect (dark slate)
  $bgPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $r = [int](36 * $scale)
  $w = $size - 1
  $h = $size - 1
  $d = $r * 2
  $bgPath.AddArc(0, 0, $d, $d, 180, 90)
  $bgPath.AddArc($w - $d, 0, $d, $d, 270, 90)
  $bgPath.AddArc($w - $d, $h - $d, $d, $d, 0, 90)
  $bgPath.AddArc(0, $h - $d, $d, $d, 90, 90)
  $bgPath.CloseFigure()
  $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 23, 25, 31))
  $g.FillPath($bgBrush, $bgPath)

  # amber lightning bolt
  $bolt = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(148 * $scale, 28 * $scale),
    [System.Drawing.PointF]::new(78 * $scale, 140 * $scale),
    [System.Drawing.PointF]::new(122 * $scale, 140 * $scale),
    [System.Drawing.PointF]::new(100 * $scale, 232 * $scale),
    [System.Drawing.PointF]::new(180 * $scale, 110 * $scale),
    [System.Drawing.PointF]::new(134 * $scale, 110 * $scale)
  )
  $boltBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 245, 158, 11))
  $g.FillPolygon($boltBrush, $bolt)

  # subtle border
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60, 245, 158, 11), ([math]::Max(1, 2 * $scale)))
  $g.DrawPath($pen, $bgPath)

  $g.Dispose()
  return $bmp
}

# PNG sizes
$pngs = @()
foreach ($s in 16, 24, 32, 48, 64, 128, 256) {
  $bmp = New-IconBitmap $s
  $p = Join-Path $dir "icon_$s.png"
  $bmp.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $pngs += @{ Size = $s; Path = $p }
}

# Build ICO container (PNG entries — supported on Vista+)
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([uint16]0)      # reserved
$bw.Write([uint16]1)      # type icon
$bw.Write([uint16]$pngs.Count)

$offset = 6 + (16 * $pngs.Count)
$dataList = @()
foreach ($e in $pngs) {
  $bytes = [System.IO.File]::ReadAllBytes($e.Path)
  $dataList += ,$bytes
  $dim = if ($e.Size -ge 256) { 0 } else { $e.Size }
  $bw.Write([byte]$dim)   # width
  $bw.Write([byte]$dim)   # height
  $bw.Write([byte]0)      # colors
  $bw.Write([byte]0)      # reserved
  $bw.Write([uint16]1)    # planes
  $bw.Write([uint16]32)   # bpp
  $bw.Write([uint32]$bytes.Length)
  $bw.Write([uint32]$offset)
  $offset += $bytes.Length
}
foreach ($bytes in $dataList) { $bw.Write($bytes) }
$bw.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $dir "icon.ico"), $ms.ToArray())
$bw.Close()

# window/preview PNG (256)
Copy-Item (Join-Path $dir "icon_256.png") (Join-Path $dir "icon.png") -Force
# clean intermediate sizes except keep 256
foreach ($s in 16, 24, 32, 48, 64, 128) { Remove-Item (Join-Path $dir "icon_$s.png") -Force -ErrorAction SilentlyContinue }
Remove-Item (Join-Path $dir "icon_256.png") -Force -ErrorAction SilentlyContinue

Write-Host "icon.ico created: $((Get-Item (Join-Path $dir 'icon.ico')).Length) bytes"
