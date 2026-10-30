export const TILE = 32;

export const enum Tile {
  Void = 0,
  Wall = 1,
  Floor = 2,
}

export type FloorType = 'burgundy' | 'red' | 'blue' | 'runner' | 'tile' | 'utility' | 'marble';

export interface Room {
  id: string;
  name: string;
  x: number; y: number; w: number; h: number; // tiles
  floor: FloorType;
}

export type FurnitureType =
  | 'sofa' | 'armchair' | 'coffeeTable' | 'roundTable' | 'diningTable' | 'banquetTable' | 'booth'
  | 'plant' | 'fountain' | 'receptionDesk' | 'barCounter' | 'counter' | 'stove' | 'fridge' | 'shelf'
  | 'crates' | 'desk' | 'monitorWall' | 'locker' | 'piano' | 'stage' | 'rug' | 'danceFloor' | 'luggageCart'
  | 'console' | 'bench' | 'cabinet' | 'safe' | 'serverRack' | 'buffet' | 'vending' | 'sideboard' | 'hostStand'
  | 'laundryCart' | 'barStools' | 'sink';

export interface Furniture {
  id: number;
  type: FurnitureType;
  x: number; y: number; w: number; h: number; // px
  rot: 0 | 1 | 2 | 3; // facing: 0 down(+y) 1 left 2 up 3 right
  solid: boolean; // blocks movement
  cover: boolean; // blocks bullets unless shooter is right behind it
  tall: boolean; // blocks light and line of sight
  variant: number;
}

export interface StaticLight {
  x: number; y: number; // px
  radius: number;
  intensity: number; // 0..1 luminance used by stealth
  color: [number, number, number];
}

export type WallDecorType = 'painting' | 'elevator' | 'sconce' | 'exitSign' | 'revolvingDoor' | 'mirror' | 'clock' | 'stairsClosed';
export interface WallDecor {
  type: WallDecorType;
  x: number; y: number; // px (centre)
  side: 'n' | 's' | 'e' | 'w'; // which side of the room the wall is on
  variant: number;
}

export interface Spot {
  x: number; y: number; // px
  room: string;
  tag?: string;
}
