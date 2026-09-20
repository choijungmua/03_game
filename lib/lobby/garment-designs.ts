export type GarmentDesign = {
  readonly color: readonly [number, number, number];
  readonly silhouette: "fitted" | "robe" | "coat";
  readonly hood: "none" | "frog" | "dino" | "shark";
};

export const GARMENT_DESIGNS: Readonly<Record<string, GarmentDesign>> = {
  overalls: { color: [83, 126, 172], silhouette: "fitted", hood: "none" },
  yukata: { color: [83, 96, 147], silhouette: "robe", hood: "none" },
  strawberry: { color: [207, 87, 100], silhouette: "robe", hood: "none" },
  raincoat: { color: [132, 174, 96], silhouette: "coat", hood: "frog" },
  dino: { color: [100, 157, 114], silhouette: "fitted", hood: "dino" },
  shark: { color: [133, 160, 179], silhouette: "fitted", hood: "shark" },
};
