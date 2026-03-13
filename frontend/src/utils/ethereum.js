import { ethers } from "ethers";

const MOCKUSDC_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

export async function connectWallet() {
  if (!window.ethereum) {
    throw new Error("MetaMask is not installed. Please install MetaMask.");
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { provider, signer, address };
}

export async function executeSafeTx({ signer, tokenAddress, functionName, args }) {
  const contract = new ethers.Contract(tokenAddress, MOCKUSDC_ABI, signer);

  let tx;
  if (functionName === "approve") {
    tx = await contract.approve(args.spender, args.amount);
  } else if (functionName === "transfer") {
    tx = await contract.transfer(args.to, args.amount);
  } else {
    throw new Error(`Unsupported function: ${functionName}`);
  }

  const receipt = await tx.wait();
  return receipt.hash;
}

export async function getTokenBalance(provider, tokenAddress, walletAddress) {
  const contract = new ethers.Contract(tokenAddress, MOCKUSDC_ABI, provider);
  const balance = await contract.balanceOf(walletAddress);
  const decimals = await contract.decimals();
  return ethers.formatUnits(balance, decimals);
}
