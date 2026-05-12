export enum ChannelAudience {
  Public = 'public',
  Members = 'members',
  Internal = 'internal'
}

export namespace ChannelAudience {
  export function parse(raw: string): ChannelAudience {
    switch (raw) {
      case 'public':
        return ChannelAudience.Public;
      case 'members':
        return ChannelAudience.Members;
      case 'internal':
        return ChannelAudience.Internal;
      default:
        throw new Error(`Unknown channel audience: ${raw}`);
    }
  }
}

export class Channel {
  private constructor(
    private readonly _name: string,
    private readonly _audience: ChannelAudience
  ) {}

  static public(name: string): Channel {
    return new Channel(name, ChannelAudience.Public);
  }

  static members(name: string): Channel {
    return new Channel(name, ChannelAudience.Members);
  }

  static internal(name: string): Channel {
    return new Channel(name, ChannelAudience.Internal);
  }

  static parse(raw: string): Channel {
    const [first, ...rest] = raw.split('/');
    if (rest.length === 0) {
      return new Channel(first, ChannelAudience.Public);
    }
    return new Channel(rest.join('/'), ChannelAudience.parse(first));
  }

  get name(): string {
    return this._name;
  }

  get audience(): ChannelAudience {
    return this._audience;
  }

  get isPublic(): boolean {
    return this._audience === ChannelAudience.Public;
  }

  equals(other: Channel): boolean {
    return this._name === other._name && this._audience === other._audience;
  }

  toString(): string {
    return `${this._audience}/${this._name}`;
  }
}
