/**
 * IOTA Wallet integration stub.
 * In production: replace with real @iota/wallet-standard or dApp Kit integration.
 */

export interface WalletState {
  connected: boolean;
  address: string | null;
  did: string | null;
  network: string;
}

const MOCK_WALLETS = {
  borrower: {
    address: "0xa3f7b2c89d4e1f0612345678901234567890abcd",
    did: "did:iota:tst:0xa3f7b2c89d4e1f0612345678901234567890abcd",
  },
  lender: {
    address: "0xb4e8c3d90a5f2e1723456789012345678901bcde",
    did: "did:iota:tst:0xb4e8c3d90a5f2e1723456789012345678901bcde",
  },
};

export async function connectWallet(
  role: "borrower" | "lender"
): Promise<WalletState> {
  // Simulate wallet connection delay
  await new Promise((r) => setTimeout(r, 1200));

  const mock = MOCK_WALLETS[role];
  return {
    connected: true,
    address: mock.address,
    did: mock.did,
    network: process.env.NEXT_PUBLIC_IOTA_NETWORK ?? "testnet",
  };
}

export async function disconnectWallet(): Promise<void> {
  await new Promise((r) => setTimeout(r, 300));
}

export async function signAndSubmitTx(
  txPayload: object
): Promise<{ txHash: string }> {
  // Simulate tx signing and submission
  await new Promise((r) => setTimeout(r, 2000));
  const mockHash = `0x${Math.random().toString(16).slice(2).padStart(64, "0")}`;
  return { txHash: mockHash };
}
