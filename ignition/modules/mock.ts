import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const BASE_FEE = "250000000000000000"; // 0.25 ether (flat fee for randomness)
const GAS_PRICE = 1e9; // 1 gwei (gas price used by VRF node)
const WEI_PER_UNIT_LINK = "5000000000000000"; // 0.005 ETH per LINK

export default buildModule("MocksModule", (m) => {
    const deployer = m.getAccount(0);

    const vrfCoordinatorV2_5Mock = m.contract(
        "VRFCoordinatorV2_5Mock",
        [BASE_FEE, GAS_PRICE, WEI_PER_UNIT_LINK],
        {
            from: deployer,
        },
    );

    return { vrfCoordinatorV2_5Mock };
});
