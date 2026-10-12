# 효과음 목소리 원본을 Windows 한국어 음성(Heami)으로 녹음한다. 가공은 voices.py가 한다
# 사용: pwsh -File scripts/audio/tts.ps1 -Out <원본 폴더>
param([Parameter(Mandatory)][string]$Out)
Add-Type -AssemblyName System.Speech
New-Item -ItemType Directory -Force $Out | Out-Null
$lines = [ordered]@{
  "three" = "셋!"; "two" = "둘!"; "one" = "하나!"; "go" = "시작!"
  "win" = "이겼다!"; "lose" = "아이고"; "record" = "신기록!"; "nice" = "좋아!"
  "wow" = "대박!"; "great" = "나이스!"; "oops" = "앗!"; "ouch" = "아야!"
  "myturn" = "내 차례!"; "timeup" = "끝!"; "woah" = "우와!"; "careful" = "조심해!"
  "hup" = "얍!"; "hurry" = "서둘러!"; "yawn" = "하아암"; "yum" = "냠냠"; "hi" = "안녕!"
  "gotit" = "잡았다!"; "ahh" = "아 시원해"; "levelup" = "레벨 업!"; "yay" = "야호!"
}
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice("Microsoft Heami Desktop")
$synth.Rate = 2
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(44100, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($key in $lines.Keys) {
  $synth.SetOutputToWaveFile((Join-Path $Out "$key.wav"), $format)
  $synth.Speak($lines[$key])
}
$synth.SetOutputToNull()
