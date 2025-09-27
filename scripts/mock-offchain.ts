import hre from "hardhat";
import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";
import { Raffle, VRFCoordinatorV2Mock } from "../typechain-types";
import MockModule from "../ignition/modules/mock";
import { Log } from "ethers";

async function mockKeepers() {
    const mockDeployment = await hre.ignition.deploy(MockModule);

    const vrfCoordinatorV2Mock =
        mockDeployment.vrfCoordinatorV2Mock as unknown as VRFCoordinatorV2Mock;

    const deploymentPath = path.join(
        __dirname,
        `../ignition/deployments/chain-${network.config.chainId}/deployed_addresses.json`,
    );

    const deploymentJson = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

    const raffleAddress = deploymentJson["RaffleModule#Raffle"];

    if (!raffleAddress) {
        throw new Error("Address not found");
    }

    const raffle = (await ethers.getContractAt(
        "Raffle",
        raffleAddress,
    )) as unknown as Raffle;

    const subscriptionId = await raffle.getSubscriptionId();

    try {
        const subscription =
            await vrfCoordinatorV2Mock.getSubscription(subscriptionId);
        const isConsumerAdded = subscription.consumers.includes(raffleAddress);

        if (!isConsumerAdded) {
            console.log("Adding consumer to subscription...");
            await vrfCoordinatorV2Mock.addConsumer(
                subscriptionId,
                raffleAddress,
            );
            console.log("Consumer added successfully!");
        } else {
            console.log("Consumer already added to subscription");
        }
    } catch (error) {
        console.log("Adding consumer to subscription...");
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId, raffleAddress);
        console.log("Consumer added successfully!");
    }

    const checkData = ethers.keccak256(ethers.toUtf8Bytes(""));

    const { upkeepNeeded } = await raffle.checkUpkeep(checkData);

    if (upkeepNeeded) {
        const tx = await raffle.performUpkeep(checkData);

        const txReceipt = await tx.wait(1);

        const event = txReceipt!.logs
            .map((log: Log) => {
                try {
                    return vrfCoordinatorV2Mock.interface.parseLog(log);
                } catch {
                    return null;
                }
            })
            .find((parsed) => parsed && parsed.name === "RandomWordsRequested");

        if (!event) {
            throw new Error("RandomWordsRequested not found");
        }

        const requestId = event.args.requestId;

        console.log(`Performed upkeep with RequestId: ${requestId}`);

        if (network.config.chainId == 31337) {
            await mockVrf(requestId, raffle);
        }
    } else {
        console.log("No upkeep needed!");
    }
}

async function mockVrf(requestId: bigint, raffle: Raffle) {
    console.log("We on a local network? Ok let's pretend...");

    const deploymentPath = path.join(
        __dirname,
        `../ignition/deployments/chain-${network.config.chainId}/deployed_addresses.json`,
    );

    const deploymentJson = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

    const mockAddress = deploymentJson["MocksModule#VRFCoordinatorV2Mock"];

    if (!mockAddress) {
        throw new Error("Address not found");
    }

    const vrfCoordinatorV2Mock: VRFCoordinatorV2Mock =
        (await ethers.getContractAt(
            "VRFCoordinatorV2Mock",
            mockAddress,
        )) as unknown as VRFCoordinatorV2Mock;

    await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, raffle.target);

    console.log("Responded!");

    const recentWinner = await raffle.getRecentWinner();

    console.log(`The winner is: ${recentWinner}`);
}

mockKeepers()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
