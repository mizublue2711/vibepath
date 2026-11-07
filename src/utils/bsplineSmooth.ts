/**
 * bsplineSmooth.ts — Uniform Cubic B-Spline GPS Coordinate Path Smoothing Algorithm
 * Smoothly interpolates [lng, lat] coordinate sequences for 3D cinematic camera trajectories
 * and connecting route lines.
 */

export type CoordinatePoint = [number, number];

/**
 * Evaluates a single cubic B-spline segment at parameter t in [0, 1]
 * with uniform open knot vector clamping.
 * Basis Matrix (Uniform Cubic B-Spline):
 * [ 1  4  1  0 ]
 * [ -3 0  3  0 ] / 6
 * [ 3 -6  3  0 ]
 * [ -1 3 -3  1 ]
 */
function evaluateCubicBSpline(
  p0: CoordinatePoint,
  p1: CoordinatePoint,
  p2: CoordinatePoint,
  p3: CoordinatePoint,
  t: number
): CoordinatePoint {
  const t2 = t * t;
  const t3 = t2 * t;

  const b0 = (1 - 3 * t + 3 * t2 - t3) / 6.0;
  const b1 = (4 - 6 * t2 + 3 * t3) / 6.0;
  const b2 = (1 + 3 * t + 3 * t2 - 3 * t3) / 6.0;
  const b3 = t3 / 6.0;

  const lng = b0 * p0[0] + b1 * p1[0] + b2 * p2[0] + b3 * p3[0];
  const lat = b0 * p0[1] + b1 * p1[1] + b2 * p2[1] + b3 * p3[1];

  return [Number(lng.toFixed(6)), Number(lat.toFixed(6))];
}

/**
 * bsplineSmooth: Generates a smooth B-spline path from discrete control points.
 * - If points count < 2: returns copy of input.
 * - If points count === 2: returns linear interpolation between the 2 points.
 * - If points count >= 3: clamps endpoints (duplicate p0 and pn) and generates cubic B-spline curve.
 *
 * @param points Array of [longitude, latitude] coordinates
 * @param samplesPerSegment Number of interpolated points per segment (default: 8)
 */
export function bsplineSmooth(
  points: CoordinatePoint[],
  samplesPerSegment: number = 8
): CoordinatePoint[] {
  if (!points || points.length < 2) {
    return points ? [...points] : [];
  }

  // Exactly 2 control points: Linear interpolation
  if (points.length === 2) {
    const [p0, p1] = points;
    const result: CoordinatePoint[] = [];
    const steps = Math.max(2, samplesPerSegment);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lng = p0[0] + (p1[0] - p0[0]) * t;
      const lat = p0[1] + (p1[1] - p0[1]) * t;
      result.push([Number(lng.toFixed(6)), Number(lat.toFixed(6))]);
    }
    return result;
  }

  // Clamped B-Spline: Duplicate start and end points to anchor endpoints
  const extended: CoordinatePoint[] = [
    points[0],
    ...points,
    points[points.length - 1],
  ];

  const smoothed: CoordinatePoint[] = [];
  const segments = extended.length - 3;

  for (let i = 0; i < segments; i++) {
    const p0 = extended[i];
    const p1 = extended[i + 1];
    const p2 = extended[i + 2];
    const p3 = extended[i + 3];

    // For each segment, sample points along the curve
    const steps = Math.max(2, samplesPerSegment);
    const startStep = i === 0 ? 0 : 1; // Avoid duplicate joining points

    for (let step = startStep; step <= steps; step++) {
      const t = step / steps;
      smoothed.push(evaluateCubicBSpline(p0, p1, p2, p3, t));
    }
  }

  return smoothed;
}
