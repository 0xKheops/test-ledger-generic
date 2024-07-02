import { signatureVerify, cryptoWaitReady } from "@polkadot/util-crypto";
import TransportNodeHID from "@ledgerhq/hw-transport-node-hid";
import { PolkadotGenericApp } from "@zondax/ledger-substrate";
import Keyring from "@polkadot/keyring";
import { u8aToHex, u8aWrapBytes } from "@polkadot/util";
import type { KeyringPair } from "@polkadot/keyring/types";

await cryptoWaitReady();

const keyring = new Keyring();

const LEDGER_ACCOUNT_PATH = "m/44'/354'/0'/0'/0'";

const SHORT_MSG = "This is a message";
const SHORT_WRAPPED = u8aWrapBytes(SHORT_MSG);

// payload of 317 bytes
const LONG_MSG =
  "This is a very long message that is going to be signed by the user. It is used to test the signature generation and verification process. It is important to test the signature generation and verification process with long messages to ensure that the signature generation and verification process is working correctly.";
const LONG_WRAPPED = u8aWrapBytes(LONG_MSG);

const alice = keyring.addFromUri(
  "//Alice",
  { name: "Alice sr25519" },
  "sr25519"
);
const bob = keyring.addFromUri("//Bob", { name: "Bob ed25519" }, "ed25519");

const logVerify = (
  label: string,
  msg: string | Uint8Array,
  sig: string | Uint8Array,
  address: string | Uint8Array
) => {
  const { crypto, isValid, isWrapped } = signatureVerify(msg, sig, address);
  console.log(
    `[${label}] crypto:${crypto}, isValid:${isValid}, isWrapped:${isWrapped}`
  );
};

const checkKeyPairSignature = async (
  label: string,
  pair: KeyringPair,
  message: string | Uint8Array
) => {
  try {
    // const transport = await TransportNodeHID.create();
    // const ledger = new PolkadotGenericApp(transport);

    // const { address } = await ledger.getAddress(LEDGER_ACCOUNT_PATH, 42);

    // const { signature } = await ledger.signRaw(
    //   LEDGER_ACCOUNT_PATH,
    //   Buffer.from(message)
    // );
    const signature = pair.sign(message);

    logVerify(
      `${pair.meta.name} ${label}`,
      message,
      u8aToHex(signature),
      pair.address
    );
  } catch (err) {
    const anyError = err as any;
    console.error(anyError?.message ?? anyError?.errorMessage ?? err);
  }
};

const checkLedgerSignature = async (
  label: string,
  message: string | Uint8Array
) => {
  try {
    console.log(`Sign message with ledger (${label})`);

    const transport = await TransportNodeHID.create();
    const ledger = new PolkadotGenericApp(transport);

    const { address } = await ledger.getAddress(LEDGER_ACCOUNT_PATH, 42);

    const { signature } = await ledger.signRaw(
      LEDGER_ACCOUNT_PATH,
      Buffer.from(message)
    );

    logVerify(`Ledger ${label}`, message, u8aToHex(signature), address);
  } catch (err) {
    const anyError = err as any;
    console.error(anyError?.message ?? anyError?.errorMessage ?? err);
  }
};

checkKeyPairSignature("SHORT MSG", alice, SHORT_MSG);
checkKeyPairSignature("SHORT WRAPPED", alice, SHORT_WRAPPED);
checkKeyPairSignature("LONG", alice, LONG_MSG);
checkKeyPairSignature("LONG WRAPPED", alice, LONG_WRAPPED);

checkKeyPairSignature("SHORT MSG", bob, SHORT_MSG);
checkKeyPairSignature("SHORT WRAPPED", bob, SHORT_WRAPPED);
checkKeyPairSignature("LONG MSG", bob, LONG_MSG);
checkKeyPairSignature("LONG WRAPPED", bob, LONG_WRAPPED);

await checkLedgerSignature("SHORT MSG", SHORT_MSG);
await checkLedgerSignature("SHORT WRAPPED", SHORT_WRAPPED);
await checkLedgerSignature("LONG MSG", LONG_MSG);
await checkLedgerSignature("LONG WRAPPED", LONG_WRAPPED);
