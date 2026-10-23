export class RubySymbol {
  constructor(readonly name: string) {}
}

export class RubyObject {
  readonly ivars = new Map<string, unknown>();

  constructor(readonly cls: string) {}

  get(name: string): unknown {
    return this.ivars.get(`@${name}`);
  }
}

export type RubyHash = Map<unknown, unknown>;

export class MarshalError extends Error {}

const utf8 = new TextDecoder("utf-8");

const ascii = new TextDecoder("latin1");

export function text(value: unknown): string {
  if (value instanceof RubySymbol) return value.name;
  if (value === null || value === undefined) return "None";
  return String(value);
}

export function truthy(value: unknown): boolean {
  if (value === null || value === undefined || value === false || value === 0 || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  if (value instanceof Map) return value.size > 0;
  return true;
}

export function isHash(value: unknown): value is RubyHash {
  return value instanceof Map;
}

export function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function hashKey(key: unknown): unknown {
  if (key instanceof RubySymbol) return key.name;
  if (Array.isArray(key)) return JSON.stringify(key.map((inner) => (inner instanceof RubySymbol ? inner.name : inner)));
  return key;
}

export function hashGet(hash: unknown, key: unknown): unknown {
  return isHash(hash) ? hash.get(hashKey(key)) : undefined;
}

function float(raw: string): number {
  if (raw === "inf") return Infinity;
  if (raw === "-inf") return -Infinity;
  if (raw === "nan") return NaN;
  return Number(raw);
}

export class MarshalReader {
  private pos = 0;
  private readonly symbols: RubySymbol[] = [];
  private readonly objects: unknown[] = [];

  constructor(private readonly data: Uint8Array) {}

  load(): unknown {
    if (this.data[0] !== 4 || this.data[1] !== 8) throw new MarshalError("not a Ruby Marshal 4.8 file");
    this.pos = 2;
    return this.read();
  }

  private byte(): number {
    if (this.pos >= this.data.length) throw new MarshalError("unexpected end of data");
    const value = this.data[this.pos];
    this.pos += 1;
    return value;
  }

  private integer(): number {
    let head = this.byte();
    head = head > 127 ? head - 256 : head;
    if (head === 0) return 0;
    if (head > 4) return head - 5;
    if (head < -4) return head + 5;
    const size = Math.abs(head);
    const bytes = this.chunk(size);
    let value = 0;
    for (let i = size - 1; i >= 0; i -= 1) value = value * 256 + bytes[i];
    return head > 0 ? value : value - 2 ** (8 * size);
  }

  private chunk(size: number): Uint8Array {
    if (size < 0 || this.pos + size > this.data.length) throw new MarshalError("unexpected end of data");
    const value = this.data.subarray(this.pos, this.pos + size);
    this.pos += size;
    return value;
  }

  private raw(): Uint8Array {
    return this.chunk(this.integer());
  }

  private register<T>(value: T): T {
    this.objects.push(value);
    return value;
  }

  private symbol(): RubySymbol {
    const value = new RubySymbol(utf8.decode(this.raw()));
    this.symbols.push(value);
    return value;
  }

  private symbolName(): RubySymbol {
    const value = this.read();
    if (!(value instanceof RubySymbol)) throw new MarshalError("expected a symbol");
    return value;
  }

  private fill(target: Map<unknown, unknown>, count: number, prefix: boolean) {
    for (let i = 0; i < count; i += 1) {
      const key = this.read();
      const value = this.read();
      target.set(prefix ? text(key) : hashKey(key), value);
    }
  }

  private read(): unknown {
    const kind = String.fromCharCode(this.byte());
    switch (kind) {
      case "0":
        return null;
      case "T":
        return true;
      case "F":
        return false;
      case "i":
        return this.integer();
      case ":":
        return this.symbol();
      case ";": {
        const found = this.symbols[this.integer()];
        if (!found) throw new MarshalError("unknown symbol link");
        return found;
      }
      case "@": {
        const index = this.integer();
        if (index < 0 || index >= this.objects.length) throw new MarshalError("unknown object link");
        return this.objects[index];
      }
      case "I": {
        const value = this.read();
        const count = this.integer();
        for (let i = 0; i < count; i += 1) {
          this.read();
          this.read();
        }
        return value;
      }
      case "e":
        this.symbolName();
        return this.read();
      case '"':
        return this.register(utf8.decode(this.raw()));
      case "f":
        return this.register(float(ascii.decode(this.raw())));
      case "l": {
        const sign = String.fromCharCode(this.byte());
        const bytes = this.chunk(2 * this.integer());
        let value = 0n;
        for (let i = bytes.length - 1; i >= 0; i -= 1) value = value * 256n + BigInt(bytes[i]);
        const number = Number(value);
        return this.register(sign === "-" ? -number : number);
      }
      case "[": {
        const value = this.register<unknown[]>([]);
        const count = this.integer();
        for (let i = 0; i < count; i += 1) value.push(this.read());
        return value;
      }
      case "{":
      case "}": {
        const value = this.register<RubyHash>(new Map());
        this.fill(value, this.integer(), false);
        if (kind === "}") this.read();
        return value;
      }
      case "o":
      case "S": {
        const value = this.register(new RubyObject(this.symbolName().name));
        this.fill(value.ivars, this.integer(), true);
        return value;
      }
      case "C":
        this.symbolName();
        return this.read();
      case "u": {
        const value = new RubyObject(this.symbolName().name);
        value.ivars.set("_dump", this.raw());
        return this.register(value);
      }
      case "U": {
        const value = this.register(new RubyObject(this.symbolName().name));
        value.ivars.set("_load", this.read());
        return value;
      }
      case "/": {
        const value = this.register(this.raw());
        this.byte();
        return value;
      }
      case "c":
      case "m":
      case "M":
        return this.register(utf8.decode(this.raw()));
      default:
        throw new MarshalError(`unsupported Marshal type ${JSON.stringify(kind)} at byte ${this.pos - 1}`);
    }
  }
}
