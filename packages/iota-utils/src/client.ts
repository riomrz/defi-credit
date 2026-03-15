/**
 * IOTA Client factory for iota-utils package
 */

export interface IOTAClientConfig {
  nodeUrl?: string;
  network?: "mainnet" | "testnet" | "devnet";
}

export function getNodeUrl(network: string = "testnet"): string {
  const urls: Record<string, string> = {
    mainnet: "https://api.mainnet.iota.cafe",
    testnet: "https://api.testnet.iota.cafe",
    devnet: "https://api.devnet.iota.cafe",
  };
  return urls[network] ?? urls.testnet;
}

export async function createIotaClient(config?: IOTAClientConfig) {
  const { IotaClient } = await import("@iota/iota-sdk/client");
  const url = config?.nodeUrl ?? getNodeUrl(config?.network);
  return new IotaClient({ url });
}

export async function createIdentityClient(config?: IOTAClientConfig) {
  const { IotaIdentityClient } = await import("@iota/identity-wasm/node");
  const iotaClient = await createIotaClient(config);
  return new IotaIdentityClient(iotaClient);
}
