// Car dimensions and physics tuning
export const WHEEL_RADIUS    = 0.35;
export const WHEEL_WIDTH     = 0.25;
export const CAR_BODY_W      = 1.6;
export const CAR_BODY_L      = 2.4;
export const CAR_BODY_H      = 0.28;
export const WHEEL_X_OUT     = 0.08;
export const WHEEL_Z_IN      = 0.45;
export const CAR_MASS        = 500;
export const WHEEL_MASS      = 10;
export const MAX_MOTOR_SPEED = 60;   // high cap so force (not speed limit) determines terminal velocity
export const MAX_MOTOR_FORCE = 280;  // per wheel — 4 wheels give 4× total force → higher top speed
export const GRIP            = 0.88;
export const SPIN_THRESHOLD  = 3;
export const START_Y         = WHEEL_RADIUS + CAR_BODY_H * 0.5 + 0.01;

// Track geometry
export const TRACK_HALF_W = 5.5;   // half-width of road (total road = 11 m)
export const WALL_H       = 1.2;   // wall height (m)
export const WALL_T       = 0.4;   // wall thickness (m)
export const N_ROAD       = 300;   // road ribbon segments
export const N_WALLS      = 200;   // wall segments per side

// Sensor config
export const SENSOR_ANGLES = [-90, -60, -35, -15, 0, 15, 35, 60, 90]; // degrees from forward
export const SENSOR_LENGTH = 8.0;   // metres

// Derived wheel position offsets (plain numbers, used to build CANNON.Vec3 in car.js)
export const WX = CAR_BODY_W * 0.5 + WHEEL_X_OUT + WHEEL_WIDTH * 0.5;
export const WY = WHEEL_RADIUS - START_Y;
export const WZ = CAR_BODY_L * 0.5 - WHEEL_Z_IN;
