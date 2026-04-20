export function encodeOsc(address, args = []) {
  return Buffer.concat([
    encodeString(address),
    encodeString(`,${args.map(typeTag).join("")}`),
    ...args.map(encodeArgument)
  ]);
}

export function decodeOsc(buffer) {
  let offset = 0;
  const address = readOscString(buffer, offset);
  offset = address.nextOffset;
  const tags = readOscString(buffer, offset);
  offset = tags.nextOffset;

  if (!tags.value.startsWith(",")) {
    return { address: address.value, args: [] };
  }

  const args = [];
  for (const tag of tags.value.slice(1)) {
    if (tag === "s") {
      const value = readOscString(buffer, offset);
      args.push(value.value);
      offset = value.nextOffset;
    } else if (tag === "i") {
      args.push(buffer.readInt32BE(offset));
      offset += 4;
    } else if (tag === "f") {
      args.push(buffer.readFloatBE(offset));
      offset += 4;
    } else if (tag === "T") {
      args.push(true);
    } else if (tag === "F") {
      args.push(false);
    } else if (tag === "N") {
      args.push(null);
    }
  }

  return { address: address.value, args };
}

export function parseData(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return "";
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
}

export function encodeSlip(buffer) {
  const bytes = [0xc0];
  for (const byte of buffer) {
    if (byte === 0xc0) bytes.push(0xdb, 0xdc);
    else if (byte === 0xdb) bytes.push(0xdb, 0xdd);
    else bytes.push(byte);
  }
  bytes.push(0xc0);
  return Buffer.from(bytes);
}

export function decodeSlip(buffer) {
  const bytes = [];
  for (let index = 0; index < buffer.length; index += 1) {
    const byte = buffer[index];
    if (byte === 0xdb && buffer[index + 1] === 0xdc) {
      bytes.push(0xc0);
      index += 1;
    } else if (byte === 0xdb && buffer[index + 1] === 0xdd) {
      bytes.push(0xdb);
      index += 1;
    } else {
      bytes.push(byte);
    }
  }
  return Buffer.from(bytes);
}

function typeTag(value) {
  if (Number.isInteger(value)) return "i";
  if (typeof value === "number") return "f";
  return "s";
}

function encodeArgument(value) {
  if (Number.isInteger(value)) {
    const buffer = Buffer.alloc(4);
    buffer.writeInt32BE(value);
    return buffer;
  }
  if (typeof value === "number") {
    const buffer = Buffer.alloc(4);
    buffer.writeFloatBE(value);
    return buffer;
  }
  return encodeString(String(value));
}

function encodeString(value) {
  const raw = Buffer.from(`${value}\0`, "utf8");
  const padding = (4 - (raw.length % 4)) % 4;
  return Buffer.concat([raw, Buffer.alloc(padding)]);
}

function readOscString(buffer, offset) {
  let end = offset;
  while (end < buffer.length && buffer[end] !== 0) end += 1;
  const value = buffer.toString("utf8", offset, end);
  const nextOffset = end + 1 + ((4 - ((end + 1) % 4)) % 4);
  return { value, nextOffset };
}
