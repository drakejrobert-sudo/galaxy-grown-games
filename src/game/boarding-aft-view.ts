import { WIDTH, type BoardingInput } from './rules';

type Point = { x: number; y: number };
export const AFT_RACK_VIEW = { x: WIDTH / 2, y: 415 };
const DEPTH = 190, FOCAL_X = 150, FOCAL_Y = 420;
const HORIZON = AFT_RACK_VIEW.y - FOCAL_Y;

// The 2D combat plane recedes toward the horizon as world y increases.
export function projectAftPoint(point: Point, rack: Point) {
  const depth = point.y - rack.y;
  const perspective = 1 / (DEPTH + depth);
  return {
    x: AFT_RACK_VIEW.x + FOCAL_X * (point.x - rack.x) * perspective,
    y: AFT_RACK_VIEW.y - FOCAL_Y * depth * perspective,
    scale: DEPTH * perspective,
  };
}

export function unprojectAftAim(point: Point, rack: Point): Point | undefined {
  if (!(point.x >= 0 && point.x <= WIDTH && point.y >= 0 && point.y <= AFT_RACK_VIEW.y)) return;
  const depth = DEPTH * (AFT_RACK_VIEW.y - point.y) / (point.y - HORIZON);
  return { x: rack.x + (point.x - AFT_RACK_VIEW.x) * (DEPTH + depth) / FOCAL_X, y: rack.y + depth };
}

export function boardingAftInput(input: BoardingInput, rack: Point): BoardingInput {
  const launch = input.launch && unprojectAftAim(input.launch, rack);
  return {
    ...input, launch,
    aim: input.aim && unprojectAftAim(input.aim, rack),
    placing: input.placing && (!input.launch || !!launch),
  };
}

export function projectAftRing(center: Point, radius: number, rack: Point) {
  return Array.from({ length: 48 }, (_, i) => {
    const angle = i * Math.PI / 24;
    return projectAftPoint({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) }, rack);
  });
}
