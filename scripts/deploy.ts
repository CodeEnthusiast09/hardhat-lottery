import hre from "hardhat";
import { network } from "hardhat";
import MockModule from "../ignition/modules/mock";
import RaffleModule from "../ignition/modules/raffle";
import {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
} from "../helper-hardhat.config";
import verify from "../utils/verify";
import { Log } from "ethers";

const FUND_AMOUNT = "1000000000000000000000";

async function main() {
    let vrfCoordinatorV2Address: string | undefined,
        subscriptionId: string | undefined;

    if (developmentChains.includes(hre.network.name)) {
        console.log("Local network detected, deploying mocks...");

        const mockResult = await hre.ignition.deploy(MockModule);

        const mock = mockResult.vrfCoordinatorV2Mock;

        vrfCoordinatorV2Address = await mock.getAddress();

        const transactionResponse = await mock.createSubscription();

        const receipt = await transactionResponse.wait();

        const event = receipt.logs
            .map((log: Log) => {
                try {
                    return mock.interface.parseLog(log);
                } catch {
                    return null;
                }
            })
            .find(
                (parsed: ReturnType<typeof mock.interface.parseLog> | null) => {
                    return parsed && parsed.name === "SubscriptionCreated";
                },
            );

        if (!event) {
            throw new Error("SubscriptionCreated event not found");
        }

        subscriptionId = event.args.subId;

        await mock.fundSubscription(subscriptionId, FUND_AMOUNT);
    } else {
        vrfCoordinatorV2Address =
            networkConfig[network.config.chainId!]["vrfCoordinatorV2"];

        subscriptionId =
            networkConfig[network.config.chainId!]["subscriptionId"];
    }

    console.log("Deploying raffle...");

    const cfg = networkConfig[network.config.chainId!];
    if (
        !cfg?.gasLane ||
        !cfg?.keepersUpdateInterval ||
        !cfg?.raffleEntranceFee ||
        !cfg?.callbackGasLimit
    ) {
        throw new Error("Missing required network config values");
    }

    const otherArgs = [
        cfg.gasLane,
        cfg.keepersUpdateInterval,
        cfg.raffleEntranceFee,
        cfg.callbackGasLimit,
    ];

    const raffleResult = await hre.ignition.deploy(RaffleModule, {
        parameters: {
            RaffleModule: {
                vrfCoordinatorV2Address: vrfCoordinatorV2Address!,
                subscriptionId: subscriptionId!,
                gasLane: cfg.gasLane,
                keepersUpdateInterval: cfg.keepersUpdateInterval,
                raffleEntranceFee: cfg.raffleEntranceFee,
                callbackGasLimit: cfg.callbackGasLimit,
            },
        },
    });

    const raffle = raffleResult.raffle;

    const raffleAddress = await raffle.getAddress();

    console.log(`Raffle deployed to: ${raffleAddress}...`);

    // Wait for block confirmations here
    const deploymentTx = raffle.deploymentTransaction();

    if (!deploymentTx) {
        console.log(
            "No new deployment transaction (contract may already be deployed).",
        );
    } else {
        const txReceipt = await hre.ethers.provider.waitForTransaction(
            deploymentTx.hash,
            VERIFICATION_BLOCK_CONFIRMATIONS,
        );

        if (!txReceipt) {
            throw new Error("Failed to fetch transaction receipt");
        }

        console.log(
            `Deployment confirmed in ${txReceipt.confirmations} blocks`,
        );
    }

    if (
        !developmentChains.includes(hre.network.name) &&
        process.env.ETHERSCAN_API_KEY
    ) {
        await verify(raffleAddress, [
            vrfCoordinatorV2Address,
            subscriptionId,
            // ...otherArgs,
            cfg.gasLane,
            cfg.keepersUpdateInterval,
            cfg.raffleEntranceFee,
            cfg.callbackGasLimit,
        ]);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
