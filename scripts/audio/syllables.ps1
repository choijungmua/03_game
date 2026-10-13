# 중얼거림 목소리(babble.py)에 쓸 음절을 Windows 한국어 여자 음성(Heami)으로 하나씩 녹음한다
# 사용: pwsh -File scripts/audio/syllables.ps1 -Out <폴더> -Syllables 셋,둘,...
param([Parameter(Mandatory)][string]$Out, [Parameter(Mandatory)][string[]]$Syllables)
Add-Type -AssemblyName System.Speech
New-Item -ItemType Directory -Force $Out | Out-Null
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.SelectVoice("Microsoft Heami Desktop")
$format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(44100, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
foreach ($syllable in ($Syllables -split ",")) {
  $synth.SetOutputToWaveFile((Join-Path $Out "$syllable.wav"), $format)
  $synth.Speak($syllable)
}
$synth.SetOutputToNull()
