import { assert, expect } from "chai";
import { network, ethers } from "hardhat";
import { developmentChains } from "../../helper-hardhat.config";
import fs from "fs";
import path from "path";
import { Raffle } from "../../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Staging Tests", function () {
          let raffle: Raffle;

          let raffleEntranceFee: bigint;

          let deployer: SignerWithAddress

          beforeEach(async function () {
              const accounts = await ethers.getSigners();

              deployer = accounts[0];

              const deploymentPath = path.join(
                  __dirname,
                  `../../ignition/deployments/chain-${network.config.chainId}/deployed_addresses.json`,
              );

              const deploymentJson = JSON.parse(
                  fs.readFileSync(deploymentPath, "utf8"),
              );

              const raffleAddress = deploymentJson["RaffleModule#Raffle"];

              if (!raffleAddress) {
                  throw new Error("Address not found");
              }

              raffle = (await ethers.getContractAt(
                  "Raffle",
                  raffleAddress,
              )) as unknown as Raffle;

              raffleEntranceFee = await raffle.getEntranceFee();

              console.log(
                  `Raffle address is ${raffleAddress} and entrance fee is ${raffleEntranceFee}`,
              );
          });

          describe("fulfillRandomWords", function () {
              it("works with live Chainlink Keepers and Chainlink VRF, we get a random winner", async function () {
                  // enter the raffle
                  console.log("Setting up test...");

                  const startingTimeStamp = await raffle.getLastTimeStamp();

                  const accounts = await ethers.getSigners();

                  console.log("Setting up Listener...");

                  await new Promise<void>(async (resolve, reject) => {
                      setTimeout(resolve, 60000);
                      // setup listener before we enter the raffle
                      // Just in case the blockchain moves REALLY fast

                      raffle.once(raffle.filters.WinnerPicked(), async () => {
                          console.log("WinnerPicked event fired!");
                          try {
                              // add our asserts here
                              const recentWinner =
                                  await raffle.getRecentWinner();

                              const raffleState = await raffle.getRaffleState();

                              const winnerEndingBalance =
                                  await ethers.provider.getBalance(
                                      accounts[0].address,
                                  );

                              const endingTimeStamp =
                                  await raffle.getLastTimeStamp();

                              await expect(raffle.getPlayer(0)).to.be.reverted;

                              assert.equal(
                                  recentWinner.toString(),
                                  accounts[0].address,
                              );

                              assert.equal(raffleState.toString(), "0");

                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  (
                                      winnerStartingBalance + raffleEntranceFee
                                  ).toString(),
                              );

                              assert(endingTimeStamp > startingTimeStamp);

                              resolve();
                          } catch (error) {
                              console.log(error);

                              reject(error);
                          }
                      });
                      // Then entering the raffle
                      console.log("Entering Raffle...");

                      const tx = await raffle.enterRaffle({
                          value: raffleEntranceFee,
                      });

                      await tx.wait(1);

                      console.log("Entered Raffle!");

                      console.log(
                          "Raffle state:",
                          (await raffle.getRaffleState()).toString(),
                      );
                      console.log(
                          "Players:",
                          (await raffle.getNumberOfPlayers()).toString(),
                      );
                      console.log(
                          "Interval:",
                          (await raffle.getInterval()).toString(),
                      );
                      console.log(
                          "Last timestamp:",
                          (await raffle.getLastTimeStamp()).toString(),
                      );
                      console.log(
                          "Current time:",
                          Math.floor(Date.now() / 1000),
                      );
                      console.log(
                          "Time difference:",
                          Math.floor(Date.now() / 1000) -
                              Number(await raffle.getLastTimeStamp()),
                      );
                      console.log(
                          "Contract balance:",
                          ethers.formatEther(
                              await ethers.provider.getBalance(raffle.target),
                          ),
                      );

                      const winnerStartingBalance =
                          await ethers.provider.getBalance(accounts[0].address);

                      console.log("Ok, time to wait...");
                      // and this code WONT complete until our listener has finished listening!
                  });
              });
          });
      });

// process to test online with the testNet Sepolia and ChainLink
// 1. Get our SubId for chainlink:
//      https://vrf.chain.link/
//      Connect Wallet
//      https://faucets.chain.link/ to get Link and Sepolia ETH. wait for comfirmation
//      https://docs.chain.link/resources/link-token-contracts to import the sepolia ETH LINKs tokens
//      https://vrf.chain.link/sepolia/new to create a new Subscription Id
//      Add some lINKs to fund the subscription
//      Received Subscription ID is 8558 update/add it the helper file

// 2. Deploy our contract using SubId
//      deploy with yarn hardhat deploy --network sepolia
//      Take the contract address and add it as consumer in the created subscription Id
//      My contract address is: 0xDDAafad590F16026358d41ea92d6FFcDcdDadEb0
//      Contract should also be verified and we can look at it on Etherscan

// 3. Register the contract with ChainLink VRF & it's SubId
//      https://automation.chain.link/ to register a new UpKeep
//      Connect Wallet
//      Time based and add the contract address
//      Confirm registration with Wallet
//      back to keepers.chain.link to see My Upkeep...

// 4. Register the contract with ChainLink Keepers
//
// 5. Run Staging test
//      We may run it from Etherscan as it is verified.
//      We  would prefer running it in visual studio code
//      yarn hardhat test --network sepolia

// import { assert, expect } from "chai";
// import { network, ethers } from "hardhat";
// import { developmentChains } from "../../helper-hardhat.config";
// import fs from "fs";
// import path from "path";
// import { Raffle } from "../../typechain-types";
// import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

// developmentChains.includes(network.name)
//     ? describe.skip
//     : describe("Raffle Debug Tests", function () {
//           let raffle: Raffle;
//           let raffleEntranceFee: bigint;
//           let deployer: SignerWithAddress;

//           this.timeout(60000); // 1 minute timeout

//           beforeEach(async function () {
//               const accounts = await ethers.getSigners();
//               deployer = accounts[0];

//               const deploymentPath = path.join(
//                   __dirname,
//                   `../../ignition/deployments/chain-${network.config.chainId}/deployed_addresses.json`,
//               );

//               const deploymentJson = JSON.parse(
//                   fs.readFileSync(deploymentPath, "utf8"),
//               );

//               const raffleAddress = deploymentJson["RaffleModule#Raffle"];

//               if (!raffleAddress) {
//                   throw new Error("Address not found");
//               }

//               raffle = (await ethers.getContractAt(
//                   "Raffle",
//                   raffleAddress,
//               )) as unknown as Raffle;

//               raffleEntranceFee = await raffle.getEntranceFee();

//               console.log(
//                   `Raffle address is ${raffleAddress} and entrance fee is ${raffleEntranceFee}`,
//               );
//           });

//           describe("Debug performUpkeep", function () {
//               it("should debug why performUpkeep is failing", async function () {
//                   console.log("=== DEBUGGING PERFORMUPKEEP ===");

//                   // First, let's check the current state
//                   console.log("1. Checking current raffle state...");
//                   const raffleState = await raffle.getRaffleState();
//                   const numPlayers = await raffle.getNumberOfPlayers();
//                   const contractBalance = await ethers.provider.getBalance(
//                       raffle.target,
//                   );
//                   const lastTimeStamp = await raffle.getLastTimeStamp();
//                   const interval = await raffle.getInterval();
//                   const currentTime = Math.floor(Date.now() / 1000);

//                   console.log(
//                       "   Raffle State:",
//                       raffleState.toString(),
//                       raffleState === 0n ? "(OPEN)" : "(CALCULATING)",
//                   );
//                   console.log("   Number of Players:", numPlayers.toString());
//                   console.log(
//                       "   Contract Balance:",
//                       ethers.formatEther(contractBalance),
//                       "ETH",
//                   );
//                   console.log("   Last Timestamp:", lastTimeStamp.toString());
//                   console.log("   Interval:", interval.toString(), "seconds");
//                   console.log("   Current Time:", currentTime);
//                   console.log(
//                       "   Time Since Last:",
//                       currentTime - Number(lastTimeStamp),
//                       "seconds",
//                   );
//                   console.log(
//                       "   Time Passed?",
//                       currentTime - Number(lastTimeStamp) > Number(interval),
//                   );

//                   // Check upkeep conditions
//                   console.log("\n2. Checking upkeep conditions...");
//                   const [upkeepNeeded, performData] =
//                       await raffle.checkUpkeep("0x");
//                   console.log("   Upkeep Needed:", upkeepNeeded);
//                   console.log("   Perform Data:", performData);

//                   if (!upkeepNeeded) {
//                       console.log(
//                           "❌ Upkeep not needed! This is why performUpkeep would fail.",
//                       );
//                       return;
//                   }

//                   // If we need more players, add one
//                   if (numPlayers === 0n) {
//                       console.log("\n3. Adding a player to the raffle...");
//                       const tx = await raffle.enterRaffle({
//                           value: raffleEntranceFee,
//                       });
//                       await tx.wait(1);
//                       console.log("   Player added!");

//                       // Check upkeep again
//                       const [upkeepNeeded2] = await raffle.checkUpkeep("0x");
//                       console.log(
//                           "   Upkeep Needed after adding player:",
//                           upkeepNeeded2,
//                       );

//                       if (!upkeepNeeded2) {
//                           console.log(
//                               "❌ Still no upkeep needed after adding player!",
//                           );
//                           return;
//                       }
//                   }

//                   // Now let's try to debug the VRF call specifically
//                   console.log("\n4. Testing VRF coordinator directly...");

//                   try {
//                       // Get the VRF coordinator interface to test it
//                       const vrfCoordinator = await ethers.getContractAt(
//                           "VRFCoordinatorV2Interface",
//                           "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625", // Sepolia VRF Coordinator
//                       );

//                       // Check if our subscription exists and is funded
//                       console.log("   Checking VRF subscription...");
//                       const subscriptionId = 4529; // From your VRF screenshot

//                       try {
//                           const subInfo =
//                               await vrfCoordinator.getSubscription(
//                                   subscriptionId,
//                               );
//                           console.log(
//                               "   Subscription Balance:",
//                               ethers.formatEther(subInfo.balance),
//                               "LINK",
//                           );
//                           console.log("   Subscription Owner:", subInfo.owner);
//                           console.log("   Consumers:", subInfo.consumers);
//                       } catch (error) {
//                           console.log(
//                               "   ❌ Could not get subscription info:",
//                               error,
//                           );
//                       }
//                   } catch (error) {
//                       console.log(
//                           "   ❌ Error checking VRF coordinator:",
//                           error,
//                       );
//                   }

//                   // Finally, try performUpkeep with detailed error catching
//                   console.log(
//                       "\n5. Attempting performUpkeep with error details...",
//                   );

//                   try {
//                       // First try to estimate gas
//                       console.log("   Estimating gas for performUpkeep...");
//                       const gasEstimate =
//                           await raffle.performUpkeep.estimateGas("0x");
//                       console.log("   Gas Estimate:", gasEstimate.toString());

//                       // If gas estimation works, try the actual call
//                       console.log("   Executing performUpkeep...");
//                       const tx = await raffle.performUpkeep("0x", {
//                           gasLimit: gasEstimate * 2n, // Use 2x estimated gas
//                       });
//                       await tx.wait(1);
//                       console.log("   ✅ performUpkeep succeeded!");
//                   } catch (error: any) {
//                       console.log("   ❌ performUpkeep failed:");
//                       console.log("   Error:", error.message);

//                       // Try to decode the error
//                       if (error.data) {
//                           console.log("   Error Data:", error.data);

//                           // Check for common Raffle errors
//                           const errorSelectors = {
//                               "0x5b2c6e1c":
//                                   "Raffle__UpkeepNotNeeded(uint256,uint256,uint256)",
//                               "0xf44170cb": "Raffle__TransferFailed()",
//                               "0x38b60fa8": "Raffle__SendMoreToEnterRaffle()",
//                               "0x5c8db6e8": "Raffle__RaffleNotOpen()",
//                           };

//                           const selector = error.data.slice(0, 10);
//                           if (errorSelectors[selector]) {
//                               console.log(
//                                   "   Decoded Error:",
//                                   errorSelectors[selector],
//                               );
//                           }
//                       }
//                   }
//               });
//           });
//       });
