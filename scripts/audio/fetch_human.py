"""실제 사람이 녹음한 한국어 낱말(Lingua Libre, Wikimedia Commons)을 대사마다 찾아 받는다.

사용: python scripts/audio/fetch_human.py <받을 폴더> <출처 기록 파일(.md)>
받은 원본은 voices.py로 가공한다. 찾지 못한 대사는 tts.ps1 녹음을 그대로 쓴다.
"""

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://commons.wikimedia.org/w/api.php"
HEADERS = {"User-Agent": "ggpli-sfx/1.0 (game sound effects; https://github.com/choijungmua/03_game)"}

# 대사 → 찾아볼 낱말 (앞에서부터 먼저 찾은 것을 쓴다)
WORDS = {
    "three": ["셋"], "two": ["둘"], "one": ["하나"], "go": ["시작"], "win": ["이기다", "승리"],
    "lose": ["아이고"], "record": ["신기록", "기록"], "nice": ["좋아", "좋다"], "wow": ["대박"],
    "great": ["나이스", "최고"], "oops": ["앗", "아"], "ouch": ["아야", "아프다"], "myturn": ["차례"],
    "timeup": ["끝"], "woah": ["우와", "와"], "careful": ["조심", "조심하다"], "hup": ["얍", "영차"],
    "hurry": ["서두르다", "빨리"], "yawn": ["하품"], "yum": ["냠냠", "맛있다"], "hi": ["안녕", "안녕하세요"],
    "gotit": ["잡다", "잡았다"], "ahh": ["시원하다", "시원해"], "levelup": ["레벨"], "yay": ["야호", "만세"],
}


def get(params: dict) -> dict:
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json"})
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=30) as response:
        return json.load(response)


def find(word: str):
    titles = [
        hit["title"]
        for hit in get({"action": "query", "list": "search", "srnamespace": 6, "srlimit": 20,
                        "srsearch": f'intitle:"LL-Q9176 (kor)" intitle:"{word}"'})["query"]["search"]
    ]
    exact = [t for t in titles if t.endswith(f"-{word}.wav")]
    if not exact:
        return None
    pages = get({"action": "query", "prop": "imageinfo", "iiprop": "url|extmetadata", "titles": exact[0]})["query"]["pages"]
    info = next(iter(pages.values()))["imageinfo"][0]
    meta = info["extmetadata"]
    return exact[0], info["url"], meta.get("LicenseShortName", {}).get("value", "?"), info.get("descriptionurl", "")


def main(out: str, credits: str) -> None:
    out_dir = Path(out)
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for line, words in WORDS.items():
        for word in words:
            found = find(word)
            if not found:
                continue
            title, url, license_name, page = found
            with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as response:
                (out_dir / f"{line}.wav").write_bytes(response.read())
            rows.append(f"| {line} | {word} | [{title.removeprefix('File:')}]({page}) | {license_name} |")
            print(line, word, license_name)
            break
        else:
            print(line, "-- 없음")
    Path(credits).write_text(
        "# 카피바라 목소리 출처\n\n"
        "아래 대사는 실제 사람이 녹음한 Lingua Libre 낱말 녹음(Wikimedia Commons)을 가공했다. "
        "표에 없는 대사는 Windows 한국어 음성(Heami)으로 만들었다.\n\n"
        "| 대사 | 낱말 | 원본 | 라이선스 |\n|---|---|---|---|\n" + "\n".join(rows) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
