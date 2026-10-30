// Hand-authored floor plan of the Grand Meridian Hotel ground floor.
// All coordinates below are in tiles (1 tile = 32 px); fractions are allowed for furniture.
import type { FloorType, Furniture, FurnitureType, Room, StaticLight, WallDecor } from './mapTypes';
import { TILE } from './mapTypes';

export const MAP_W = 112;
export const MAP_H = 76;

export interface LayoutData {
  rooms: Room[];
  doors: { x: number; y: number; w: number; h: number; floor: FloorType }[];
  walls: { x: number; y: number; w: number; h: number }[]; // extra interior walls / pillars
  furniture: Furniture[];
  lights: StaticLight[];
  decor: WallDecor[];
  spawnsAT: [number, number][];
  hostageSpots: { x: number; y: number; room: string }[];
  weaponSpots: { x: number; y: number; weapon: 'mp5' | 'm4' | 'deagle' }[];
  crateSpots: [number, number][];
  plateSpots: [number, number][];
  patrolRoutes: [number, number][][];
  extraction: { x: number; y: number; w: number; h: number };
}

export function buildLayout(): LayoutData {
  const rooms: Room[] = [
    { id: 'service', name: 'Service Corridor', x: 2, y: 2, w: 106, h: 3, floor: 'utility' },
    { id: 'kitchen', name: 'Kitchen', x: 2, y: 6, w: 24, h: 20, floor: 'tile' },
    { id: 'ballroom', name: 'Grand Ballroom', x: 28, y: 6, w: 44, h: 24, floor: 'blue' },
    { id: 'storageA', name: 'Linen Storage', x: 74, y: 6, w: 14, h: 10, floor: 'utility' },
    { id: 'storageB', name: 'Supply Storage', x: 90, y: 6, w: 18, h: 10, floor: 'utility' },
    { id: 'staff', name: 'Staff Room', x: 74, y: 18, w: 16, h: 11, floor: 'red' },
    { id: 'security', name: 'Security Office', x: 92, y: 18, w: 16, h: 11, floor: 'blue' },
    { id: 'corridor', name: 'Main Corridor', x: 28, y: 32, w: 80, h: 4, floor: 'runner' },
    { id: 'restaurant', name: 'Restaurant', x: 2, y: 28, w: 24, h: 22, floor: 'red' },
    { id: 'private', name: 'Private Dining', x: 2, y: 52, w: 24, h: 14, floor: 'burgundy' },
    { id: 'lobby', name: 'Main Lobby', x: 28, y: 38, w: 44, h: 30, floor: 'burgundy' },
    { id: 'reception', name: 'Reception', x: 74, y: 38, w: 16, h: 16, floor: 'burgundy' },
    { id: 'office', name: 'Back Office', x: 92, y: 38, w: 16, h: 12, floor: 'red' },
    { id: 'lounge', name: 'Lounge Bar', x: 74, y: 56, w: 34, h: 12, floor: 'blue' },
    { id: 'vestibule', name: 'Entrance', x: 44, y: 69, w: 12, h: 4, floor: 'marble' },
  ];

  const doors: LayoutData['doors'] = [
    { x: 5, y: 5, w: 3, h: 1, floor: 'utility' },
    { x: 48, y: 5, w: 4, h: 1, floor: 'utility' },
    { x: 79, y: 5, w: 2, h: 1, floor: 'utility' },
    { x: 98, y: 5, w: 2, h: 1, floor: 'utility' },
    { x: 88, y: 10, w: 2, h: 2, floor: 'utility' },
    { x: 80, y: 16, w: 2, h: 2, floor: 'red' },
    { x: 104, y: 16, w: 2, h: 2, floor: 'blue' },
    { x: 90, y: 22, w: 2, h: 2, floor: 'red' },
    { x: 72, y: 22, w: 2, h: 2, floor: 'blue' },
    { x: 26, y: 12, w: 2, h: 2, floor: 'tile' },
    { x: 10, y: 26, w: 3, h: 2, floor: 'tile' },
    { x: 40, y: 30, w: 4, h: 2, floor: 'blue' },
    { x: 56, y: 30, w: 4, h: 2, floor: 'blue' },
    { x: 81, y: 29, w: 2, h: 3, floor: 'red' },
    { x: 99, y: 29, w: 2, h: 3, floor: 'blue' },
    { x: 26, y: 33, w: 2, h: 2, floor: 'runner' },
    { x: 36, y: 36, w: 6, h: 2, floor: 'burgundy' },
    { x: 58, y: 36, w: 6, h: 2, floor: 'burgundy' },
    { x: 76, y: 36, w: 5, h: 2, floor: 'burgundy' },
    { x: 96, y: 36, w: 2, h: 2, floor: 'red' },
    { x: 26, y: 44, w: 2, h: 3, floor: 'red' },
    { x: 12, y: 50, w: 3, h: 2, floor: 'burgundy' },
    { x: 26, y: 58, w: 2, h: 3, floor: 'burgundy' },
    { x: 72, y: 42, w: 2, h: 10, floor: 'burgundy' },
    { x: 90, y: 44, w: 2, h: 2, floor: 'red' },
    { x: 80, y: 54, w: 4, h: 2, floor: 'blue' },
    { x: 72, y: 60, w: 2, h: 5, floor: 'blue' },
    { x: 102, y: 50, w: 2, h: 6, floor: 'red' },
    { x: 46, y: 68, w: 8, h: 1, floor: 'marble' },
    { x: 8, y: 22, w: 1, h: 2, floor: 'tile' }, // freezer door
  ];

  const walls: LayoutData['walls'] = [
    // lobby pillars
    { x: 34, y: 44, w: 2, h: 2 }, { x: 34, y: 60, w: 2, h: 2 }, { x: 64, y: 44, w: 2, h: 2 }, { x: 64, y: 60, w: 2, h: 2 },
    // ballroom pillars
    { x: 37, y: 14, w: 2, h: 2 }, { x: 61, y: 14, w: 2, h: 2 }, { x: 37, y: 23, w: 2, h: 2 }, { x: 61, y: 23, w: 2, h: 2 },
    // restaurant pillar
    { x: 13, y: 38, w: 2, h: 2 },
    // walk-in freezer in the kitchen corner
    { x: 2, y: 19, w: 7, h: 1 }, { x: 8, y: 19, w: 1, h: 7 },
    // reception back partition
    { x: 86, y: 39, w: 1, h: 3 },
  ];

  const furniture: Furniture[] = [];
  let fid = 1;
  const F = (
    type: FurnitureType, x: number, y: number, w: number, h: number,
    o: Partial<Pick<Furniture, 'rot' | 'solid' | 'cover' | 'tall' | 'variant'>> = {},
  ) => {
    const d = DEFAULTS[type];
    furniture.push({
      id: fid++, type, x: x * TILE, y: y * TILE, w: w * TILE, h: h * TILE,
      rot: o.rot ?? 0, solid: o.solid ?? d.solid, cover: o.cover ?? d.cover, tall: o.tall ?? d.tall, variant: o.variant ?? 0,
    });
  };
  const seating = (cx: number, cy: number, variant = 0) => {
    F('rug', cx - 3.6, cy - 2.8, 7.2, 5.6, { variant });
    F('coffeeTable', cx - 1.1, cy - 0.6, 2.2, 1.2);
    F('sofa', cx - 1.8, cy - 2.4, 3.6, 1.3, { rot: 0, variant });
    F('sofa', cx - 1.8, cy + 1.1, 3.6, 1.3, { rot: 2, variant });
    F('armchair', cx - 3.2, cy - 0.65, 1.3, 1.3, { rot: 3, variant });
    F('armchair', cx + 1.9, cy - 0.65, 1.3, 1.3, { rot: 1, variant });
  };

  // ---- Lobby ----
  F('fountain', 47.5, 50.5, 5, 5);
  seating(41, 52.5, 0);
  seating(59, 52.5, 0);
  seating(41, 63, 1);
  seating(59, 63, 1);
  for (const [x, y] of [[28.15, 38.15], [70.85 - 0.9, 38.15], [28.15, 66.95 - 0.9], [70.85 - 0.9, 66.95 - 0.9]]) F('plant', x, y, 0.9, 0.9);
  F('console', 44, 38.05, 4, 0.8);
  F('console', 52, 38.05, 4, 0.8);
  F('plant', 48.4, 38.1, 0.8, 0.8, { variant: 1 });
  F('luggageCart', 58, 66, 1.7, 1.1);
  F('bench', 29, 46.6, 1, 3.6, { rot: 3 });
  F('bench', 70, 55.6, 1, 3.6, { rot: 1 });

  // ---- Reception ----
  F('receptionDesk', 78, 41, 1.5, 9, { rot: 1 });
  F('receptionDesk', 78, 41, 6, 1.4, { variant: 1 });
  F('receptionDesk', 78, 48.6, 6, 1.4, { variant: 1 });
  F('cabinet', 88, 39, 2, 1, { tall: true });
  F('plant', 74.15, 38.15, 0.9, 0.9);
  F('plant', 74.15, 52.9, 0.9, 0.9);
  F('bench', 74.3, 45, 1, 3.4, { rot: 3 });
  F('desk', 82.5, 44.5, 2.4, 1.3, { rot: 1 });

  // ---- Back office ----
  F('desk', 95, 40, 3, 1.5);
  F('desk', 100, 40, 3, 1.5);
  F('desk', 95, 44.5, 3, 1.5);
  F('cabinet', 106, 39, 2, 1, { tall: true });
  F('cabinet', 106, 42, 2, 1, { tall: true });
  F('safe', 105.6, 45.6, 1.8, 1.8);
  F('plant', 92.15, 38.15, 0.9, 0.9);

  // ---- Lounge ----
  F('barCounter', 84, 57.6, 14, 1.4);
  F('barStools', 84.5, 59.1, 13, 0.8, { solid: false, cover: false });
  F('sofa', 76, 66.4, 4, 1.3, { rot: 2, variant: 2 });
  F('sofa', 100, 66.4, 4, 1.3, { rot: 2, variant: 2 });
  for (const [x, y] of [[80, 62.5], [92, 63], [101, 61.5]]) {
    F('rug', x - 2.6, y - 2.2, 5.2, 4.4, { variant: 2 });
    F('coffeeTable', x - 0.7, y - 0.7, 1.4, 1.4, { variant: 1 });
    F('armchair', x - 2.2, y - 0.65, 1.3, 1.3, { rot: 3, variant: 2 });
    F('armchair', x + 0.9, y - 0.65, 1.3, 1.3, { rot: 1, variant: 2 });
  }
  F('plant', 74.15, 56.15, 0.9, 0.9);
  F('plant', 106.95 - 0.9, 56.15, 0.9, 0.9);
  F('piano', 104, 58.8, 2.6, 2.2, { variant: 1 });

  // ---- Corridor ----
  for (const x of [33, 51, 67, 88, 106]) F('plant', x, 32.1, 0.8, 0.8, { variant: 1 });
  F('console', 44, 35.1, 4, 0.8);
  F('console', 66, 35.1, 4, 0.8);
  F('console', 86, 35.1, 4, 0.8);
  F('luggageCart', 73, 33.3, 1.7, 1.1);
  F('laundryCart', 93, 32.3, 1.6, 1.1);

  // ---- Ballroom ----
  F('stage', 40, 6, 20, 4);
  F('piano', 54.5, 6.6, 2.8, 2.4);
  F('danceFloor', 46.2, 13, 7.6, 8);
  for (const [x, y] of [[32, 11.5], [43.5, 11.5], [56.5, 11.5], [67.5, 11.5], [32, 19], [43, 18.5], [57, 18.5], [67.5, 19], [32, 26.5], [44.5, 25.5], [55.5, 25.5], [67.5, 26.5]]) {
    F('roundTable', x - 1.15, y - 1.15, 2.3, 2.3, { variant: Math.floor(x * 7 + y) % 3 });
  }
  F('buffet', 28.2, 7, 1.3, 4);
  F('plant', 28.15, 28.9, 0.9, 0.9);
  F('plant', 70.95, 28.9, 0.9, 0.9);

  // ---- Kitchen ----
  F('stove', 10, 6.05, 6, 1.4);
  F('counter', 8, 11, 8, 2);
  F('counter', 8, 16, 8, 1.8);
  F('fridge', 2, 7, 1, 2);
  F('fridge', 2, 10, 1, 2);
  F('sink', 24.55, 15, 1.4, 6, { rot: 1 });
  F('shelf', 19, 6, 5, 1);
  F('counter', 18, 21.6, 6, 1.4, { variant: 1 });
  F('serverRack', 2, 20.2, 1, 1, { tall: false, variant: 2 }); // freezer rack (low)
  F('shelf', 5, 24.9, 3, 1, { tall: false }); // freezer shelf

  // ---- Restaurant ----
  for (const y of [29.5, 34.5, 41, 45.8]) F('booth', 2.05, y, 2.2, 3);
  for (const [x, y] of [[8, 31], [16, 31], [21.5, 31], [8, 44], [17, 44], [21.5, 44], [20, 38], [7.5, 37.5]]) F('diningTable', x - 0.85, y - 0.85, 1.7, 1.7, { variant: Math.floor(x + y) % 2 });
  F('hostStand', 23.6, 32.6, 1, 0.9);
  F('plant', 24.9, 28.15, 0.9, 0.9);
  F('plant', 24.9, 48.95, 0.9, 0.9);

  // ---- Private dining ----
  F('rug', 5, 54.5, 16, 7);
  F('banquetTable', 7, 56.8, 12, 2.4);
  F('sideboard', 2.05, 54.5, 1, 6, { rot: 3 });
  F('plant', 24.95, 52.1, 0.9, 0.9);
  F('plant', 24.95, 64.95, 0.9, 0.9);
  F('armchair', 21, 63.6, 1.3, 1.3, { rot: 2, variant: 1 });

  // ---- Storage ----
  F('shelf', 76, 8, 1, 5, { rot: 1 });
  F('shelf', 83, 8, 1, 5, { rot: 1 });
  F('crates', 85, 12.5, 2, 2);
  F('laundryCart', 78.5, 13.8, 1.6, 1.1);
  F('shelf', 93, 8, 1, 6, { rot: 1 });
  F('shelf', 97, 8, 1, 6, { rot: 1 });
  F('shelf', 101, 8, 1, 6, { rot: 1 });
  F('crates', 105, 6.5, 2, 2, { variant: 1 });
  F('crates', 91, 13.5, 1.6, 1.6);

  // ---- Staff room ----
  F('locker', 75, 18, 4, 1);
  F('locker', 84, 18, 4, 1);
  F('diningTable', 79, 22.2, 3.2, 2, { variant: 2 });
  F('sofa', 84.5, 27.5, 3.4, 1.3, { rot: 2, variant: 2 });
  F('vending', 88, 24, 1, 2);
  F('plant', 74.15, 27.95, 0.9, 0.9);

  // ---- Security ----
  F('monitorWall', 94, 18, 9, 1);
  F('desk', 95, 20.6, 7, 1.4, { variant: 2 });
  F('serverRack', 106, 20, 1, 2);
  F('serverRack', 106, 24, 1, 2);
  F('cabinet', 92.1, 26.6, 2.4, 1.2, { variant: 1 });

  // ---- Service corridor ----
  F('laundryCart', 20, 2.3, 1.6, 1.1);
  F('crates', 64, 2.2, 1.6, 1.6);

  const lights: StaticLight[] = [
    { x: 41, y: 52.5, radius: 230, intensity: 0.42, color: [255, 196, 128] },
    { x: 59, y: 52.5, radius: 230, intensity: 0.42, color: [255, 196, 128] },
    { x: 50, y: 53, radius: 150, intensity: 0.3, color: [150, 190, 255] },
    { x: 82, y: 45, radius: 190, intensity: 0.42, color: [255, 190, 120] },
    { x: 91, y: 58, radius: 240, intensity: 0.5, color: [255, 170, 100] },
    { x: 34, y: 32.6, radius: 140, intensity: 0.38, color: [255, 186, 120] },
    { x: 50, y: 32.6, radius: 140, intensity: 0.38, color: [255, 186, 120] },
    { x: 66, y: 32.6, radius: 140, intensity: 0.38, color: [255, 186, 120] },
    { x: 85, y: 32.6, radius: 140, intensity: 0.38, color: [255, 186, 120] },
    { x: 102, y: 32.6, radius: 140, intensity: 0.38, color: [255, 186, 120] },
    { x: 14, y: 14, radius: 210, intensity: 0.32, color: [200, 220, 255] },
    { x: 98, y: 19.6, radius: 190, intensity: 0.4, color: [120, 170, 255] },
    { x: 50, y: 8, radius: 260, intensity: 0.4, color: [255, 200, 140] },
    { x: 42, y: 29.4, radius: 80, intensity: 0.22, color: [255, 60, 50] },
    { x: 58, y: 29.4, radius: 80, intensity: 0.22, color: [255, 60, 50] },
    { x: 87.5, y: 25, radius: 110, intensity: 0.3, color: [140, 220, 255] },
    { x: 15, y: 3.5, radius: 110, intensity: 0.28, color: [255, 120, 60] },
    { x: 55, y: 3.5, radius: 110, intensity: 0.28, color: [255, 120, 60] },
    { x: 95, y: 3.5, radius: 110, intensity: 0.28, color: [255, 120, 60] },
    { x: 3.5, y: 58.5, radius: 160, intensity: 0.4, color: [255, 140, 70] },
    { x: 96.5, y: 41, radius: 120, intensity: 0.34, color: [255, 210, 150] },
    { x: 12, y: 44, radius: 120, intensity: 0.3, color: [255, 170, 110] },
    { x: 50, y: 70.6, radius: 200, intensity: 0.38, color: [190, 210, 255] },
  ].map((l) => ({ ...l, x: l.x * TILE, y: l.y * TILE } as StaticLight));

  const D = (type: WallDecor['type'], x: number, y: number, side: WallDecor['side'], variant = 0): WallDecor => ({ type, x: x * TILE, y: y * TILE, side, variant });
  const decor: WallDecor[] = [
    D('elevator', 28, 50.5, 'w', 0), D('elevator', 28, 54, 'w', 1),
    D('painting', 46, 38, 'n', 0), D('painting', 54, 38, 'n', 1), D('painting', 28, 41.5, 'w', 2), D('painting', 72, 66, 'e', 3),
    D('painting', 33, 68, 's', 1), D('painting', 66, 68, 's', 2),
    D('mirror', 31, 6, 'n'), D('mirror', 68, 6, 'n'),
    D('painting', 6, 52, 'n', 3), D('painting', 18, 52, 'n', 0), D('painting', 2, 31, 'w', 1),
    D('painting', 38, 32, 'n', 2), D('painting', 62, 32, 'n', 3), D('painting', 92, 32, 'n', 0),
    D('clock', 82, 38, 'n'), D('painting', 98, 56, 'n', 1),
    D('revolvingDoor', 47, 73, 's'), D('revolvingDoor', 53, 73, 's'),
    D('exitSign', 42, 30, 's'), D('exitSign', 58, 30, 's'),
    D('stairsClosed', 108, 3.5, 'e'), D('stairsClosed', 2, 3.5, 'w'),
    D('sconce', 34, 32, 'n'), D('sconce', 50, 32, 'n'), D('sconce', 66, 32, 'n'), D('sconce', 85, 32, 'n'), D('sconce', 102, 32, 'n'),
  ];

  return {
    rooms, doors, walls, furniture, lights, decor,
    spawnsAT: [[46, 70.3], [48.5, 70.8], [51, 70.3], [53.5, 70.8], [47.5, 71.8], [52, 71.8]],
    hostageSpots: [
      { x: 4.6, y: 23.4, room: 'Walk-in Freezer' },
      { x: 79.8, y: 11.5, room: 'Linen Storage' },
      { x: 104, y: 11.5, room: 'Supply Storage' },
      { x: 103.5, y: 26.5, room: 'Security Office' },
      { x: 77, y: 26.6, room: 'Staff Room' },
      { x: 4, y: 63.5, room: 'Private Dining' },
      { x: 93.6, y: 48, room: 'Back Office' },
      { x: 70, y: 7.6, room: 'Grand Ballroom' },
      { x: 106.2, y: 63.2, room: 'Lounge Bar' },
    ],
    weaponSpots: [
      { x: 17, y: 14, weapon: 'mp5' }, { x: 96, y: 24.5, weapon: 'mp5' }, { x: 60, y: 27.5, weapon: 'mp5' }, { x: 88, y: 64.5, weapon: 'mp5' },
      { x: 80, y: 9, weapon: 'm4' }, { x: 106.4, y: 34, weapon: 'm4' }, { x: 21, y: 47.6, weapon: 'm4' }, { x: 100, y: 46.5, weapon: 'm4' },
      { x: 84, y: 46, weapon: 'deagle' }, { x: 12, y: 61, weapon: 'deagle' }, { x: 66, y: 8, weapon: 'deagle' },
      { x: 31, y: 62.5, weapon: 'mp5' }, { x: 68.5, y: 48, weapon: 'm4' }, { x: 55, y: 41, weapon: 'deagle' },
      { x: 38, y: 34, weapon: 'mp5' }, { x: 10, y: 47.5, weapon: 'mp5' }, { x: 22, y: 54, weapon: 'm4' },
      { x: 5, y: 16, weapon: 'm4' }, { x: 34, y: 8, weapon: 'mp5' }, { x: 50, y: 28, weapon: 'm4' },
      { x: 86, y: 21, weapon: 'deagle' }, { x: 78, y: 57.5, weapon: 'deagle' }, { x: 76, y: 40.5, weapon: 'mp5' },
      { x: 40, y: 3.5, weapon: 'm4' },
    ],
    crateSpots: [[23.5, 9], [30.5, 34.5], [36, 66.4], [64, 66.4], [44, 23], [16, 64.5], [100, 66.4], [52, 66.6], [70.4, 41], [86.5, 14.5], [107, 9.5], [88.6, 27.6], [96, 59.6], [23.6, 64.6], [29.4, 50.5], [3.2, 49]],
    plateSpots: [[18, 24.5], [40, 8.6], [75, 15], [107, 27.6], [30, 66.4], [77, 59.5], [106.5, 48.6], [5.5, 28.8], [60, 34.5]],
    patrolRoutes: [
      [[32, 41], [68, 41], [68, 66], [32, 66]],
      [[30, 34], [70, 34], [106, 34], [70, 34]],
      [[33, 16.5], [50, 11], [66, 16], [66, 22], [50, 23], [33, 22.5]],
      [[8, 40], [22, 40], [22, 29], [11, 28.8], [11, 24], [5, 14], [20, 14], [11, 24]],
      [[80, 11], [90, 11], [100, 11], [104, 22], [96, 25], [86, 23], [80, 22]],
      [[83, 46], [98, 47], [102.5, 52.5], [95, 62], [78, 60], [76, 52]],
      [[5, 3.5], [40, 3.5], [75, 3.5], [106, 3.5]],
      [[10, 55], [22, 61], [32, 59], [22, 63.5], [6, 63.5]],
    ],
    extraction: { x: 44, y: 67, w: 12, h: 6 },
  };
}

const DEFAULTS: Record<FurnitureType, { solid: boolean; cover: boolean; tall: boolean }> = {
  sofa: { solid: true, cover: true, tall: false },
  armchair: { solid: true, cover: true, tall: false },
  coffeeTable: { solid: true, cover: false, tall: false },
  roundTable: { solid: true, cover: true, tall: false },
  diningTable: { solid: true, cover: true, tall: false },
  banquetTable: { solid: true, cover: true, tall: false },
  booth: { solid: true, cover: true, tall: false },
  plant: { solid: true, cover: false, tall: false },
  fountain: { solid: true, cover: true, tall: false },
  receptionDesk: { solid: true, cover: true, tall: false },
  barCounter: { solid: true, cover: true, tall: false },
  counter: { solid: true, cover: true, tall: false },
  stove: { solid: true, cover: true, tall: false },
  fridge: { solid: true, cover: true, tall: true },
  shelf: { solid: true, cover: true, tall: true },
  crates: { solid: true, cover: true, tall: false },
  desk: { solid: true, cover: true, tall: false },
  monitorWall: { solid: true, cover: true, tall: true },
  locker: { solid: true, cover: true, tall: true },
  piano: { solid: true, cover: true, tall: false },
  stage: { solid: false, cover: false, tall: false },
  rug: { solid: false, cover: false, tall: false },
  danceFloor: { solid: false, cover: false, tall: false },
  luggageCart: { solid: true, cover: true, tall: false },
  console: { solid: true, cover: false, tall: false },
  bench: { solid: true, cover: false, tall: false },
  cabinet: { solid: true, cover: true, tall: false },
  safe: { solid: true, cover: true, tall: false },
  serverRack: { solid: true, cover: true, tall: true },
  buffet: { solid: true, cover: true, tall: false },
  vending: { solid: true, cover: true, tall: true },
  sideboard: { solid: true, cover: true, tall: false },
  hostStand: { solid: true, cover: false, tall: false },
  laundryCart: { solid: true, cover: true, tall: false },
  barStools: { solid: false, cover: false, tall: false },
  sink: { solid: true, cover: true, tall: false },
};
