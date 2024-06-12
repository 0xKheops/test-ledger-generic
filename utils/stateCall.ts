import { TypeRegistry } from "@polkadot/types";
import type { Codec, DetectCodec } from "@polkadot/types/types";
import { u8aConcatStrict } from "@polkadot/util";

import type { WsProvider } from "@polkadot/rpc-provider";
import type { HexString } from "@polkadot/util/types";

export const stateCall = async <K extends string = string>(
  provider: WsProvider,
  method: string,
  resultType: K,
  args: Codec[],
  blockHash?: HexString,
  isCacheable?: boolean
): Promise<DetectCodec<Codec, K>> => {
  try {
    // use registry from the first argument if any, in case arg is a custom type
    const registry = args.length ? args[0].registry : new TypeRegistry();

    const bytes = registry.createType(
      "Raw",
      args.length ? u8aConcatStrict(args.map((arg) => arg.toU8a())) : undefined
    );

    const result = await provider.send(
      "state_call",
      [method, bytes.toHex(), blockHash],
      isCacheable
    );

    return registry.createType(resultType, result);
  } catch (error) {
    console.error("stateCall", { error });
    throw error;
    //    return Err((error as Error).message);
  }
};
