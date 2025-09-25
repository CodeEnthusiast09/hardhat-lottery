// import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
// import MocksModule from "./mock";

// export default buildModule("RaffleModule", (m) => {
//     const deployer = m.getAccount(0);

//     const { vrfCoordinatorV2Mock } = m.useModule(MocksModule);

//     const raffle = m.contract("Raffle", [vrfCoordinatorV2Mock], {
//         from: deployer,
//     });

//     return { raffle };
// });

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("RaffleModule", (m) => {
    const deployer = m.getAccount(0);

    const vrfCoordinatorV2Address = m.getParameter("vrfCoordinatorV2Address");
    const subscriptionId = m.getParameter("subscriptionId");
    const gasLane = m.getParameter("gasLane");
    const keepersUpdateInterval = m.getParameter("keepersUpdateInterval");
    const raffleEntranceFee = m.getParameter("raffleEntranceFee");
    const callbackGasLimit = m.getParameter("callbackGasLimit");

    const raffle = m.contract(
        "Raffle",
        [
            vrfCoordinatorV2Address,
            subscriptionId,
            gasLane,
            keepersUpdateInterval,
            raffleEntranceFee,
            callbackGasLimit,
        ],
        { from: deployer },
    );

    return { raffle };
});
