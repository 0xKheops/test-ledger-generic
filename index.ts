import { WsProvider } from "@polkadot/rpc-provider";
import { TypeRegistry } from "@polkadot/types";
import fs from "fs";
import path from "path";
import { encodeAddress } from "@polkadot/util-crypto";
import TransportNodeHID from "@ledgerhq/hw-transport-node-hid";
import { PolkadotGenericApp } from "@zondax/ledger-substrate";
import type { SignerPayloadJSON } from "@polkadot/types/types";

const LEDGER_ACCOUNT_ADDRESS =
  "5EXb7e8Kq9m62XTFKVYmGsHFADU4knyFNg6NKJmLKDCz4Gij";
const LEDGER_ACCOUNT_PATH = "m/44'/354'/0'/0'/0'";

// Original payload sent by http://polkadot.js.org/apps to the wallet when sending 0.1 ROC to another address
const PJS_PAYLOAD_BASE = {
  specVersion: "0x000f7121",
  transactionVersion: "0x0000001a",
  address: "5EXb7e8Kq9m62XTFKVYmGsHFADU4knyFNg6NKJmLKDCz4Gij",
  assetId: null,
  blockHash:
    "0xd443968b727d4d9070c60649074df6860d36fa5b47db052f5a7c498763587f04",
  blockNumber: "0x00a5a3e4",
  era: "0x4502",
  genesisHash:
    "0x6408de7737c59c238890533af25896a2c20608d8b380bb01029acb392781063e",
  metadataHash: null,
  method:
    "0x040300183982ce80e4b52f2e80aaf36d18b1eba1a32005ffbefd952962227f2f4db3090700e8764817",
  mode: 0,
  nonce: "0x00000006",
  signedExtensions: [
    "CheckNonZeroSender",
    "CheckSpecVersion",
    "CheckTxVersion",
    "CheckGenesis",
    "CheckMortality",
    "CheckNonce",
    "CheckWeight",
    "ChargeTransactionPayment",
    "CheckMetadataHash",
  ],
  tip: "0x00000000000000000000000000000000",
  version: 4,
} as unknown as SignerPayloadJSON;

/**
 * fetch dynamic inputs
 */
const reqMetadataHash = await fetch(
  "https://api.zondax.ch/polkadot/node/metadata/hash",
  {
    method: "POST",
    body: JSON.stringify({ id: "roc" }),
    headers: {
      "Content-Type": "application/json",
    },
  }
);
const { metadataHash } = await reqMetadataHash.json();
console.log("metadata hash", metadataHash);

const provider = new WsProvider("wss://rococo-rpc.polkadot.io");
await provider.isReady;

const [blockHash, block, nonce] = await Promise.all([
  provider.send("chain_getBlockHash", []),
  provider.send("chain_getBlock", []),
  provider.send("system_accountNextIndex", [PJS_PAYLOAD_BASE.address]),
]);

/**
 * Code below downloads metadata V15 from chain and stores is to disk.
 * Uncomment if it needs to be refreshed, otherwise only read from disk
 */
// const provider = new WsProvider("wss://rococo-rpc.polkadot.io");
// await provider.isReady;

// const hexMetadata15 = await getLatestMetadataRpc(provider);
// fs.writeFileSync(path.join(__dirname, "metadataV15.hex"), hexMetadata15);

const hexMetadataV15 = fs.readFileSync(path.join(__dirname, "metadataV15.hex"));

const registry15 = new TypeRegistry();
const metadata15 = registry15.createType("Metadata", hexMetadataV15.toString());
registry15.setMetadata(metadata15, PJS_PAYLOAD_BASE.signedExtensions);

/**
 * Craft final extrinsic payload
 */

const payload: SignerPayloadJSON = {
  ...PJS_PAYLOAD_BASE,

  address: LEDGER_ACCOUNT_ADDRESS,
  blockHash,
  blockNumber: block.block.header.number,
  nonce,
  era: "0x", // immortal, to avoid computing a valid value
  tip: "0x",
  mode: 1,
  metadataHash: `0x${metadataHash}`,
};

const extPayload = registry15.createType("ExtrinsicPayload", payload);

console.log("payload", extPayload.toHuman());
console.log("payload hex", extPayload.toHex());

/**
 * Sign and submit
 */
try {
  const transport = await TransportNodeHID.create();
  const ledger = new PolkadotGenericApp(
    transport,
    "roc",
    "https://api.zondax.ch/polkadot/transaction/metadata"
  );

  const { address } = await ledger.getAddress(LEDGER_ACCOUNT_PATH, 42);
  if (encodeAddress(address) !== encodeAddress(PJS_PAYLOAD_BASE.address))
    throw new Error("Wrong address");

  const { signature } = await ledger.sign(
    LEDGER_ACCOUNT_PATH,
    Buffer.from(extPayload.toU8a(true))
  );
  console.log("signature", signature.toString("hex"));

  const tx = registry15.createType(
    "Extrinsic",
    { method: PJS_PAYLOAD_BASE.method },
    { version: PJS_PAYLOAD_BASE.version }
  );

  const signedPayload = tx.addSignature(
    address,
    `0x${signature.toString("hex")}`,
    payload
  );

  console.log("signed tx", signedPayload.toHex());

  const res = await provider.send("author_submitExtrinsic", [
    signedPayload.toHex(),
  ]);
  console.log("LFG", res);
} catch (err) {
  const error = err as any;
  if (error.isAxiosError)
    console.error("Failed to generate metadata", error.toString());
  else console.error(error);
}
