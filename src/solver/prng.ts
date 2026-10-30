/**
 * Seeded Pseudo-Random Number Generator (Mulberry32)
 * 
 * Provides fast, high-quality 32-bit pseudo-random numbers with reproducible seeds.
 */

export class Mulberry32 {
  private state: number;

  constructor(seed: number = 42) {
    this.state = seed >>> 0;
  }

  /**
   * Returns a float in [0, 1)
   */
  public next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * Returns a float in [min, max)
   */
  public nextRange(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /**
   * Returns an integer in [min, max] inclusive
   */
  public nextInt(min: number, max: number): number {
    return Math.floor(this.nextRange(min, max + 1));
  }

  /**
   * Returns a Gaussian distributed random variable (Box-Muller)
   */
  public nextGaussian(mean: number = 0, stdDev: number = 1): number {
    let u1 = this.next();
    let u2 = this.next();
    while (u1 <= 1e-15) u1 = this.next();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + z0 * stdDev;
  }

  public getSeed(): number {
    return this.state;
  }

  public setSeed(seed: number): void {
    this.state = seed >>> 0;
  }
}
