import type { GroundAsset } from "../../types";

/** 풀밭 (마을 안·밖 풀밭, 막히는 타일의 바닥) */
export default { id: "meadow", category: "ground", fallbackColor: "#8cbf3f" } as const satisfies GroundAsset;
