$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$records = @()
foreach ($count in @(8,12,17,23,30)) {
    $bmp = [System.Drawing.Bitmap]::new((Resolve-Path "data/sources/friedman-squintri-$count.gif").Path)
    $width = $bmp.Width
    $height = $bmp.Height
    $visited = [bool[]]::new($width*$height)
    $components = @()
    $dark = @()
    for ($y=0; $y -lt $height; $y++) {
        for ($x=0; $x -lt $width; $x++) {
            $c=$bmp.GetPixel($x,$y)
            if ($c.R -eq 0 -and $c.G -eq 0 -and $c.B -eq 0) { $dark += ,@($x,$y) }
            $idx=$y*$width+$x
            if ($visited[$idx] -or $c.R -ne 181 -or $c.G -ne 181 -or $c.B -ne 181) {continue}
            $queue=[System.Collections.Generic.Queue[int]]::new()
            $queue.Enqueue($idx)
            $visited[$idx]=$true
            $points=[System.Collections.Generic.List[object]]::new()
            while ($queue.Count -gt 0) {
                $idx2=$queue.Dequeue()
                $px=$idx2 % $width
                $py=[int][Math]::Floor($idx2/$width)
                $points.Add(@($px,$py))
                foreach ($neighbor in @(@(($px-1),$py),@(($px+1),$py),@($px,($py-1)),@($px,($py+1)))) {
                    $nx=[int]$neighbor[0];$ny=[int]$neighbor[1]
                    if ($nx -lt 0 -or $ny -lt 0 -or $nx -ge $width -or $ny -ge $height) {continue}
                    $ni=$ny*$width+$nx
                    if ($visited[$ni]) {continue}
                    $nc=$bmp.GetPixel($nx,$ny)
                    if ($nc.R -eq 181 -and $nc.G -eq 181 -and $nc.B -eq 181) {
                        $visited[$ni]=$true;$queue.Enqueue($ni)
                    }
                }
            }
            if ($points.Count -gt 50) { $components += ,($points.ToArray()) }
        }
    }
    $records += @{n=$count;width=$width;height=$height;components=$components;dark=$dark}
    $bmp.Dispose()
}
New-Item -ItemType Directory -Force data/reconstructions | Out-Null
$records | ConvertTo-Json -Depth 8 -Compress | Set-Content -Encoding utf8 data/reconstructions/triangle-pixel-regions.json
$records | ForEach-Object { Write-Output "n=$($_.n), components=$($_.components.Count)" }
