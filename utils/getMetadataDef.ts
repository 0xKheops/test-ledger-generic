import { TypeRegistry } from "@polkadot/types";
import type { OpaqueMetadata } from "@polkadot/types/interfaces";
import { u8aToNumber } from "@polkadot/util";
import type { HexString } from "@polkadot/util/types";

import { stateCall } from "./stateCall";
import type { WsProvider } from "@polkadot/rpc-provider";

export const getLatestMetadataRpc = async (
  provider: WsProvider,
  blockHash?: string
) => {
  try {
    const versions = await stateCall(
      provider,
      "Metadata_metadata_versions",
      "Vec<u32>",
      [],
      blockHash as HexString,
      true
    );

    const numVersions = versions.toJSON() as number[];
    const latest = Math.max(...numVersions.filter((v) => v <= 15)); // 15 is the max Talisman supports for now
    const version = new TypeRegistry().createType("u32", latest);

    const opaqueMetadata = await stateCall(
      provider,
      "Metadata_metadata_at_version",
      "OpaqueMetadata",
      [version],
      blockHash as HexString,
      true
    );

    return metadataFromOpaque(opaqueMetadata as OpaqueMetadata);
  } catch (err) {
    // maybe the chain doesn't have metadata_versions or metadata_at_version runtime calls - ex: crust standalone
    // fetch metadata the old way
    if ((err as { message?: string })?.message?.includes("is not found"))
      return provider.send<HexString>(
        "state_getMetadata",
        [blockHash],
        !!blockHash
      );

    // eslint-disable-next-line no-console
    console.error("getLatestMetadataRpc", { err });

    throw err;
  } finally {
  }
};

const metadataFromOpaque = (opaque: OpaqueMetadata) => {
  try {
    // pjs codec for OpaqueMetadata doesn't allow us to decode the actual Metadata, find it ourselves
    const u8aBytes = opaque.toU8a();
    for (let i = 0; i < 20; i++) {
      // skip until we find the magic number that is used as prefix of metadata objects (usually in the first 10 bytes)
      if (u8aToNumber(u8aBytes.slice(i, i + 4)) !== 0x6174656d) continue;

      const metadata = new TypeRegistry().createType(
        "Metadata",
        u8aBytes.slice(i)
      );

      return metadata.toHex();
    }
    throw new Error("Magic number not found");
  } catch (cause) {
    throw new Error("Failed to decode metadata from OpaqueMetadata", { cause });
  }
};
