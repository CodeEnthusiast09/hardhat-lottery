import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const BASE_FEE = "250000000000000000"; // 0.25 is this the premium in LINK?
const GAS_PRICE_LINK = 1e9;

export default buildModule("MocksModule", (m) => {
    const deployer = m.getAccount(0);

    const vrfCoordinatorV2Mock = m.contract(
        "VRFCoordinatorV2Mock",
        [BASE_FEE, GAS_PRICE_LINK],
        { from: deployer },
    );

    return { vrfCoordinatorV2Mock };
});
