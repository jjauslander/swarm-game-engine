import { unzipSync, strFromU8 } from "fflate";
import type { GamePackage } from "./types.ts";
export function unpack(
  bytes: Uint8Array,
  validate: (p: unknown) => string[],
): GamePackage {
  if (bytes.length > 2000000) throw Error("Archive too large");
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (header.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (
    end < 0 ||
    header.getUint16(end + 8, true) !== 1 ||
    header.getUint16(end + 10, true) !== 1
  )
    throw Error("Expected one archive entry");
  const central = header.getUint32(end + 16, true);
  if (
    central + 46 > bytes.length ||
    header.getUint32(central, true) !== 0x02014b50
  )
    throw Error("Invalid archive directory");
  if (((header.getUint32(central + 38, true) >>> 16) & 0xf000) === 0xa000)
    throw Error("Archive symlinks unsupported");
  let count = 0;
  let total = 0;
  const entries = unzipSync(bytes, {
    filter: (f) => {
      total += f.originalSize;
      if (++count > 1) throw Error("Duplicate archive entry");
      if (
        total > 5000000 ||
        f.name !== "package.json" ||
        f.originalSize > 5000000
      )
        throw Error("Unsupported archive entry/size");
      return true;
    },
  });
  if (Object.keys(entries).length !== 1 || !entries["package.json"])
    throw Error("Expected package.json only");
  const p = JSON.parse(strFromU8(entries["package.json"]));
  const errors = validate(p);
  if (errors.length) throw Error(errors.join("\n"));
  return p;
}
