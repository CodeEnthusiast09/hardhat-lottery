import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { assert, expect } from "chai";
import { network, ethers } from "hardhat";
import { Raffle, VRFCoordinatorV2Mock } from "../../typechain-types";
import { networkConfig, developmentChains } from "../../helper-hardhat.config";
import MockModule from "../../ignition/modules/mock";
import RaffleModule from "../../ignition/modules/raffle";
import hre from "hardhat";
import { Log } from "ethers";

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit Tests", function () {
          let raffle: Raffle;

          let vrfCoordinatorV2Mock: VRFCoordinatorV2Mock;

          let raffleEntranceFee: bigint;

          let interval: bigint;

          let player: SignerWithAddress;

          let accounts: SignerWithAddress[];

          let rafflePlayer: Raffle;

          let intervalNumber: number;

          beforeEach(async () => {
              accounts = await ethers.getSigners();

              player = accounts[1];

              const mockDeployment = await hre.ignition.deploy(MockModule);

              vrfCoordinatorV2Mock =
                  mockDeployment.vrfCoordinatorV2Mock as unknown as VRFCoordinatorV2Mock;

              const tx = await vrfCoordinatorV2Mock.createSubscription();

              const receipt = await tx.wait();

              const event = receipt!.logs
                  .map((log: Log) => {
                      try {
                          return vrfCoordinatorV2Mock.interface.parseLog(log);
                      } catch {
                          return null;
                      }
                  })
                  .find(
                      (parsed) =>
                          parsed && parsed.name === "SubscriptionCreated",
                  );

              if (!event) {
                  throw new Error("SubscriptionCreated event not found");
              }

              const subscriptionId = event.args.subId;

              await vrfCoordinatorV2Mock.fundSubscription(
                  subscriptionId,
                  ethers.parseEther("10"),
              );

              // Pull config
              const chainId = network.config.chainId!;
              const cfg = networkConfig[chainId];

              const raffleDeployment = await hre.ignition.deploy(RaffleModule, {
                  parameters: {
                      RaffleModule: {
                          vrfCoordinatorV2Address:
                              await vrfCoordinatorV2Mock.getAddress(),
                          subscriptionId,
                          gasLane: cfg.gasLane!,
                          keepersUpdateInterval: cfg.keepersUpdateInterval!,
                          raffleEntranceFee: cfg.raffleEntranceFee!,
                          callbackGasLimit: cfg.callbackGasLimit!,
                      },
                  },
              });

              raffle = raffleDeployment.raffle as unknown as Raffle;

              await vrfCoordinatorV2Mock.addConsumer(
                  subscriptionId,
                  await raffle.getAddress(),
              );

              rafflePlayer = raffle.connect(player);

              raffleEntranceFee = await raffle.getEntranceFee();

              interval = await raffle.getInterval();

              intervalNumber = Number(interval);
          });

          describe("constructor", function () {
              it("intitiallizes the raffle correctly", async () => {
                  // Ideally, we'd separate these out so that only 1 assert per "it" block
                  // And ideally, we'd make this check everything
                  const raffleState = (
                      await raffle.getRaffleState()
                  ).toString();

                  assert.equal(raffleState, "0");

                  assert.equal(
                      interval.toString(),
                      networkConfig[network.config.chainId!][
                          "keepersUpdateInterval"
                      ],
                  );
              });
          });

          describe("enterRaffle", function () {
              it("reverts when you don't pay enough", async () => {
                  await expect(
                      raffle.enterRaffle(),
                  ).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__SendMoreToEnterRaffle",
                  );
              });

              it("records player when they enter", async () => {
                  await rafflePlayer.enterRaffle({ value: raffleEntranceFee });

                  const contractPlayer = await raffle.getPlayer(0);

                  assert.equal(await player.getAddress(), contractPlayer);
              });

              it("emits event on enter", async () => {
                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee }),
                  ).to.emit(raffle, "RaffleEnter");
              });

              it("doesn't allow entrance when raffle is calculating", async () => {
                  await rafflePlayer.enterRaffle({ value: raffleEntranceFee });

                  await network.provider.send("evm_increaseTime", [
                      intervalNumber + 1,
                  ]);

                  await network.provider.request({
                      method: "evm_mine",
                      params: [],
                  });

                  // we pretend to be a keeper for a second
                  await raffle.performUpkeep("0x");

                  await expect(
                      rafflePlayer.enterRaffle({ value: raffleEntranceFee }),
                  ).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__RaffleNotOpen",
                  );
              });
          });

          describe("checkUpkeep", function () {
              it("returns false if people haven't sent any ETH", async () => {
                  await network.provider.send("evm_increaseTime", [
                      intervalNumber + 1,
                  ]);

                  await network.provider.request({
                      method: "evm_mine",
                      params: [],
                  });

                  const { upkeepNeeded } = await raffle.checkUpkeep("0x");

                  assert(!upkeepNeeded);
              });

              it("returns false if raffle isn't open", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });

                  await network.provider.send("evm_increaseTime", [
                      intervalNumber + 1,
                  ]);

                  await network.provider.request({
                      method: "evm_mine",
                      params: [],
                  });

                  await raffle.performUpkeep("0x");

                  const raffleState = await raffle.getRaffleState();

                  const { upkeepNeeded } = await raffle.checkUpkeep("0x");

                  assert.equal(
                      raffleState.toString() == "1",
                      upkeepNeeded == false,
                  );
              });

              it("returns false if enough time hasn't passed", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });

                  await network.provider.send("evm_increaseTime", [
                      intervalNumber - 2,
                  ]);

                  await network.provider.request({
                      method: "evm_mine",
                      params: [],
                  });

                  const { upkeepNeeded } = await raffle.checkUpkeep("0x");

                  assert(!upkeepNeeded);
              });

              it("returns true if enough time has passed, has players, eth, and is open", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });

                  await network.provider.send("evm_increaseTime", [
                      intervalNumber + 1,
                  ]);
                  await network.provider.request({
                      method: "evm_mine",
                      params: [],
                  });
                  const { upkeepNeeded } = await raffle.checkUpkeep("0x");
                  assert(upkeepNeeded);
              });
          });

          describe("performUpkeep", function () {
              it("can only run if checkupkeep is true", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });

                  await network.provider.send("evm_increaseTime", [
                      intervalNumber + 1,
                  ]);

                  await network.provider.request({
                      method: "evm_mine",
                      params: [],
                  });

                  const tx = await raffle.performUpkeep("0x");

                  assert(tx);
              });

              it("reverts if checkup is false", async () => {
                  await expect(
                      raffle.performUpkeep("0x"),
                  ).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__UpkeepNotNeeded",
                  );
              });

              it("updates the raffle state and emits a requestId", async () => {
                  // Too many asserts in this test!
                  await raffle.enterRaffle({ value: raffleEntranceFee });

                  await network.provider.send("evm_increaseTime", [
                      intervalNumber + 1,
                  ]);

                  await network.provider.request({
                      method: "evm_mine",
                      params: [],
                  });

                  const txResponse = await raffle.performUpkeep("0x");

                  const txReceipt = await txResponse.wait(1);

                  const raffleState = await raffle.getRaffleState();

                  const event = txReceipt!.logs
                      .map((log: Log) => {
                          try {
                              return vrfCoordinatorV2Mock.interface.parseLog(
                                  log,
                              );
                          } catch {
                              return null;
                          }
                      })
                      .find(
                          (parsed) =>
                              parsed && parsed.name === "RandomWordsRequested",
                      );

                  if (!event) {
                      throw new Error("RandomWordsRequested not found");
                  }

                  //   const requestId = event.args.subId![1].args!.requestId;
                  const requestId = event.args.requestId;

                  assert(requestId > 0);

                  assert(raffleState.toString() === "1");
              });
          });

          describe("fulfillRandomWords", function () {
              beforeEach(async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });

                  await network.provider.send("evm_increaseTime", [
                      intervalNumber + 1,
                  ]);

                  await network.provider.request({
                      method: "evm_mine",
                      params: [],
                  });
              });

              it("can only be called after performupkeep", async () => {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffle.target),
                  ).to.be.revertedWith("nonexistent request");

                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffle.target),
                  ).to.be.revertedWith("nonexistent request");
              });

              // This test is too big...
              it("picks a winner, resets, and sends money", async () => {
                  const additionalEntrances = 3;

                  const startingIndex = 2;

                  const allParticipants = [player];

                  // Add additional participants and store their addresses
                  for (
                      let i = startingIndex;
                      i < startingIndex + additionalEntrances;
                      i++
                  ) {
                      const raffleParticipants = raffle.connect(accounts[i]);

                      await raffleParticipants.enterRaffle({
                          value: raffleEntranceFee,
                      });

                      allParticipants.push(accounts[i]);
                  }

                  const startingTimeStamp = await raffle.getLastTimeStamp();

                  // This will be more important for our staging tests...
                  await new Promise<void>(async (resolve, reject) => {
                      raffle.once(raffle.filters.WinnerPicked(), async () => {
                          // assert throws an error if it fails, so we need to wrap
                          // it in a try/catch so that the promise returns event
                          // if it fails.
                          try {
                              // Now lets get the ending values...
                              const recentWinner =
                                  await raffle.getRecentWinner();

                              const raffleState = await raffle.getRaffleState();

                              const winnerBalance =
                                  await ethers.provider.getBalance(
                                      accounts[2].address,
                                  );

                              const endingTimeStamp =
                                  await raffle.getLastTimeStamp();

                              await expect(raffle.getPlayer(0)).to.be.reverted;

                              assert.equal(
                                  recentWinner.toString(),
                                  accounts[2].address,
                              );

                              assert.equal(raffleState.toString(), "0");

                              assert.equal(
                                  winnerBalance.toString(),
                                  (
                                      startingBalance +
                                      raffleEntranceFee *
                                          BigInt(additionalEntrances) +
                                      raffleEntranceFee
                                  ).toString(),
                              );

                              assert(endingTimeStamp > startingTimeStamp);

                              resolve();
                          } catch (e) {
                              reject(e);
                          }
                      });

                      const tx = await raffle.performUpkeep("0x");

                      const txReceipt = await tx.wait(1);

                      const startingBalance = await ethers.provider.getBalance(
                          accounts[2].address,
                      );

                      // Extract the requestId from the emitted event logs
                      const event = txReceipt!.logs
                          .map((log: Log) => {
                              try {
                                  return vrfCoordinatorV2Mock.interface.parseLog(
                                      log,
                                  );
                              } catch {
                                  return null;
                              }
                          })
                          .find(
                              (parsed) =>
                                  parsed &&
                                  parsed.name === "RandomWordsRequested",
                          );

                      if (!event) {
                          throw new Error(
                              "RandomWordsRequested event not found",
                          );
                      }

                      const requestId = event.args.requestId;

                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          requestId,
                          raffle.target,
                      );
                  });
              });
          });
      });
