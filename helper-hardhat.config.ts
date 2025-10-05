import { ethers } from "hardhat";

export interface networkConfigItem {
    name?: string;
    subscriptionId?: string;
    gasLane?: string;
    keepersUpdateInterval?: string;
    raffleEntranceFee?: string;
    callbackGasLimit?: string;
    vrfCoordinatorV2_5?: string;
}

export interface networkConfigInfo {
    [key: number]: networkConfigItem;
}

export const networkConfig: networkConfigInfo = {
    31337: {
        name: "localhost",
        subscriptionId: "588",
        gasLane:
            "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // 30 gwei
        keepersUpdateInterval: "180",
        raffleEntranceFee: ethers.parseEther("0.01").toString(), // 0.01 ETH
        callbackGasLimit: "500000", // 500,000 gas
    },
    11155111: {
        name: "sepolia",
        subscriptionId:
            "57458313366285643664447462583623105256718767822971408006239186772063943734529",
        gasLane:
            "0x787d74caea10b2b357790d5b5247c2f63d1d91572a9846f780606e4d953677ae", // 30 gwei
        keepersUpdateInterval: "30",
        raffleEntranceFee: ethers.parseEther("0.01").toString(), // 0.01 ETH
        callbackGasLimit: "2500000",
        vrfCoordinatorV2_5: "0x9DdfaCa8183c41ad55329BdeeD9F6A8d53168B1B",
    },
    1: {
        name: "mainnet",
        keepersUpdateInterval: "30",
    },
};

export const developmentChains = ["hardhat", "localhost"];
export const VERIFICATION_BLOCK_CONFIRMATIONS = 6;
export const frontEndContractsFile =
    "../smart-contract-lottery/src/lib/contract-address.json";
export const frontEndAbiFile = "../smart-contract-lottery/src/lib/abi.json";
export const frontEndUtils = "../smart-contract-lottery/src/lib/contracts.ts";
