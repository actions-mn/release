export class Version {
  constructor(
    private readonly major: number,
    private readonly minor: number,
    private readonly patch: number
  ) {}

  static parse(versionString: string): Version {
    const match = versionString.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
      throw new Error(`Invalid version format: ${versionString}`);
    }
    return new Version(
      parseInt(match[1], 10),
      parseInt(match[2], 10),
      parseInt(match[3], 10)
    );
  }

  gte(other: Version): boolean {
    if (this.major !== other.major) {
      return this.major > other.major;
    }
    if (this.minor !== other.minor) {
      return this.minor > other.minor;
    }
    return this.patch >= other.patch;
  }

  lt(other: Version): boolean {
    return !this.gte(other);
  }

  toString(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  }
}

export const MINIMUM_MODERN_VERSION = new Version(1, 10, 0);
