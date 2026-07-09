// Off-track rule: the road surface is 8 m wide (4 m half-width) plus a 0.9 m kerb
// on each side — riding the kerb is legal racing. Past that, allow most of a car
// width of leniency before calling it grass.
const ROAD_HALF_WIDTH = 4;
const KERB_WIDTH = 0.9;
const LENIENCY = 0.7;
export const OFF_TRACK_DISTANCE = ROAD_HALF_WIDTH + KERB_WIDTH + LENIENCY;

export function isOffRoad(distanceFromCenterline: number): boolean {
  return distanceFromCenterline > OFF_TRACK_DISTANCE;
}
