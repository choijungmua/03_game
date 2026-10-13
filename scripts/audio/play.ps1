# 가공한 목소리 대사를 하나씩 스피커로 들려준다
# 사용: pwsh -File scripts/audio/play.ps1 [-Dir public/sfx/voice]
param([string]$Dir = (Join-Path $PSScriptRoot "../../public/sfx/voice"))
$names = @{ three = "셋"; two = "둘"; one = "하나"; go = "시작!"; win = "이겼다!"; lose = "아이고"; record = "신기록!"; nice = "좋아!"; wow = "대박!"; great = "나이스!"; oops = "앗!"; ouch = "아야!"; myturn = "내 차례!"; timeup = "끝!"; woah = "우와!"; careful = "조심해!"; hup = "얍!"; hurry = "서둘러!"; yawn = "하아암"; yum = "냠냠"; hi = "안녕!"; gotit = "잡았다!"; ahh = "아 시원해"; levelup = "레벨 업!"; yay = "야호!" }
$order = "three", "two", "one", "go", "nice", "great", "wow", "woah", "yay", "win", "record", "levelup", "lose", "oops", "ouch", "careful", "hurry", "timeup", "myturn", "hup", "hi", "gotit", "yum", "yawn", "ahh"
$i = 0
foreach ($key in $order) {
  $i++
  Write-Output "$i/$($order.Count) $key ($($names[$key]))"
  (New-Object System.Media.SoundPlayer (Join-Path $Dir "$key.wav")).PlaySync()
  Start-Sleep -Milliseconds 1000
}
