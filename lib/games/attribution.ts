const STORAGE_KEY = "game-first-touch";

interface Attribution {
  readonly landingPath: string;
  readonly referrerDomain: string;
  readonly utmSource: string;
  readonly utmMedium: string;
  readonly utmCampaign: string;
}

let firstTouch: Attribution | undefined;

export function captureAttribution(): Attribution {
  if (firstTouch) return firstTouch;
  const query = new URLSearchParams(location.search);
  let referrerDomain = "";
  try {
    referrerDomain = document.referrer ? new URL(document.referrer).hostname : "";
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
  }
  firstTouch = {
    landingPath: location.pathname, referrerDomain,
    utmSource: query.get("utm_source") ?? "",
    utmMedium: query.get("utm_medium") ?? "",
    utmCampaign: query.get("utm_campaign") ?? "",
  };
  try {
    const saved = new URLSearchParams(sessionStorage.getItem(STORAGE_KEY) ?? "");
    const landingPath = saved.get("landingPath");
    if (landingPath?.startsWith("/")) {
      firstTouch = {
        landingPath, referrerDomain: saved.get("referrerDomain") ?? "",
        utmSource: saved.get("utmSource") ?? "", utmMedium: saved.get("utmMedium") ?? "",
        utmCampaign: saved.get("utmCampaign") ?? "",
      };
    } else {
      sessionStorage.setItem(STORAGE_KEY, new URLSearchParams({ ...firstTouch }).toString());
    }
  } catch { // no-excuse-ok: telemetry must work in memory when browser storage is unavailable.
    return firstTouch;
  }
  return firstTouch;
}
