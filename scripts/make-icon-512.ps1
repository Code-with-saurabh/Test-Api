Add-Type -AssemblyName System.Drawing
function New-IconBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $scale = $size / 256.0
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $r = [int](36 * $scale); $w = $size - 1; $h = $size - 1; $d = $r * 2
  $path.AddArc(0, 0, $d, $d, 180, 90)
  $path.AddArc($w - $d, 0, $d, $d, 270, 90)
  $path.AddArc($w - $d, $h - $d, $d, $d, 0, 90)
  $path.AddArc(0, $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $bg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 23, 25, 31))
  $g.FillPath($bg, $path)
  $bolt = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(148 * $scale, 28 * $scale),
    [System.Drawing.PointF]::new(78 * $scale, 140 * $scale),
    [System.Drawing.PointF]::new(122 * $scale, 140 * $scale),
    [System.Drawing.PointF]::new(100 * $scale, 232 * $scale),
    [System.Drawing.PointF]::new(180 * $scale, 110 * $scale),
    [System.Drawing.PointF]::new(134 * $scale, 110 * $scale)
  )
  $bb = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 245, 158, 11))
  $g.FillPolygon($bb, $bolt)
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60, 245, 158, 11), ([math]::Max(1, 2 * $scale)))
  $g.DrawPath($pen, $path)
  $g.Dispose()
  return $bmp
}
$out = Join-Path (Split-Path $PSScriptRoot -Parent) 'resources'
$bmp = New-IconBitmap 512
$bmp.Save((Join-Path $out 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "icon.png 512x512 saved"
