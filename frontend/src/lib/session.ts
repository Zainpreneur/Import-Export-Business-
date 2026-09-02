import { AppConfig, UserSession } from "@stacks/connect";
import { showConnect } from "@stacks/connect";

// The scopes we need from the wallet: just enough to know who the user
// is and to sign the contract-call transactions the app builds.
export const appConfig = new AppConfig(["store_write"]);
export const userSession = new UserSession({ appConfig });

const appDetails = {
  name: "Import / Export Trade Desk",
  icon: `${window.location.origin}/vite.svg`,
};

export function connectWallet(onFinish: () => void) {
  showConnect({
    appDetails,
    userSession,
    onFinish,
    onCancel: () => {
      // user closed the wallet popup without connecting
    },
  });
}

export function disconnectWallet() {
  userSession.signUserOut();
}

export function isSignedIn(): boolean {
  return userSession.isUserSignedIn();
}

export function getCurrentAddress(testnet: boolean): string | null {
  if (!userSession.isUserSignedIn()) return null;
  const profile = userSession.loadUserData().profile;
  return testnet ? profile.stxAddress.testnet : profile.stxAddress.mainnet;
}
