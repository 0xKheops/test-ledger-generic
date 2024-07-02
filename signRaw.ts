import { signatureVerify, cryptoWaitReady } from "@polkadot/util-crypto";
import TransportNodeHID from "@ledgerhq/hw-transport-node-hid";
import { PolkadotGenericApp } from "@zondax/ledger-substrate";
import Keyring from "@polkadot/keyring";
import { u8aToHex, u8aWrapBytes } from "@polkadot/util";

await cryptoWaitReady();

const keyring = new Keyring();

const LEDGER_ACCOUNT_PATH = "m/44'/354'/0'/0'/0'";

const SHORT_MSG = "This is a message";

// payload of 317 bytes
const LONG_MSG =
  "This is a very long message that is going to be signed by the user. It is used to test the signature generation and verification process. It is important to test the signature generation and verification process with long messages to ensure that the signature generation and verification process is working correctly.";

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

const checkLedgerSignature = async (label: string, message: string) => {
  try {
    const wrappedMessage = u8aWrapBytes(message);

    console.log(`Sign message with ledger (${label})`);

    const transport = await TransportNodeHID.create();
    const ledger = new PolkadotGenericApp(transport);

    const { address } = await ledger.getAddress(LEDGER_ACCOUNT_PATH, 42);

    const { signature } = await ledger.signRaw(
      LEDGER_ACCOUNT_PATH,
      Buffer.from(wrappedMessage)
    );

    logVerify(
      `Ledger ${label}`,
      message,
      u8aToHex(signature.slice(1)),
      address
    );
  } catch (err) {
    console.error((err as any)?.message ?? err);
  }
};

const aliceShortSig = alice.sign(SHORT_MSG);
logVerify(`${alice.meta.name} SHORT`, SHORT_MSG, aliceShortSig, alice.address);
const aliceLongSig = alice.sign(LONG_MSG);
logVerify(`${alice.meta.name} LONG`, LONG_MSG, aliceLongSig, alice.address);

const bobShortSig = bob.sign(SHORT_MSG);
logVerify(`${bob.meta.name} SHORT`, SHORT_MSG, bobShortSig, bob.address);
const bobLongSig = bob.sign(LONG_MSG);
logVerify(`${bob.meta.name} LONG`, LONG_MSG, bobLongSig, bob.address);

await checkLedgerSignature("SHORT", SHORT_MSG);
await checkLedgerSignature("LONG", LONG_MSG);
