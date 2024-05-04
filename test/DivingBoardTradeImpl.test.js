const dotenv = require("dotenv");
const { ethers, upgrades } = require("hardhat");
const { SignerWithAddress } = require("@nomiclabs/hardhat-ethers/signers");
const { Contract, BigNumber } = require("ethers");
const { expectRevert, constants } = require("@openzeppelin/test-helpers");
const keccak256 = require("keccak256");
const { assert, expect } = require("chai");
const Web3 = require('web3');
const web3 = new Web3(process.env.NODE_PROVIDER);
const { latest } = require("@nomicfoundation/hardhat-network-helpers/dist/src/helpers/time");

dotenv.config();

const EVENTS = {
    TRADE_CREATED: "TradeCreated",
    TRADE_RESOLVED: "TradeResolved",
    REWARD_CLAIMED: "RewardClaimed",
    ADMIN_ADDED: "AdminAdded",
    ADMIN_REMOVED: "AdminRemoved",
    OWNER_ADDED: "OwnerAdded",
    OWNER_REMOVED: "OwnerRemoved",
    SIGNER_ADDED: "SignerAdded",
    SIGNER_REMOVED: "SignerRemoved"
};

const { ZERO_BYTES32, ZERO_ADDRESS } = constants;

let OWNER, trader, MAX, ADMIN, ANGELINA, LEONARDO, JENNIFER, TOM, GEORGE, TREASURY;
// let abiCoder = new ethers.utils.AbiCoder();
let divingBoardTradeDeployContract;
let thresholdAmount = 1000000000000000;
const tokenName = "Diving Board Trade Contract";
const symbol = "DBTC";
const decimals = 18;
const initialSupply = 5000000000;
let mintAmount = 100
let tradeCount = 0;
let tradeId = 1;
let ADMIN_ROLE, OWNER_ROLE, SIGNER_ROLE;
let expiry;
let tokenMetadata = "abc.com";
let tradedAmount = 5;

before(async () => {
    [OWNER_ROLE, trader, MAX, ADMIN, SIGNER_ROLE, LEONARDO, JENNIFER, TOM, GEORGE, TREASURY] = await ethers.getSigners();

    const SampleERC20TokenContract = await ethers.deployContract("SampleERC20Token", [tokenName, symbol, decimals, initialSupply]);
    erc20 = await SampleERC20TokenContract.deployed();

    const amount = ethers.utils.parseUnits(mintAmount.toString(), decimals);
    await erc20.mint(trader.address, amount);
    // await erc20.mint(TREASURY.address, amount);

    const DivingBoardTradeImpl = await ethers.getContractFactory("DivingBoardTradeImpl");
    divingBoardTradeDeployContract = await upgrades.deployProxy(DivingBoardTradeImpl, [thresholdAmount, TREASURY.address, tokenName, symbol, ADMIN.address, OWNER_ROLE.address]);
    
    await erc20.mint(divingBoardTradeDeployContract.address, amount);

    ADMIN_ROLE = await divingBoardTradeDeployContract.ADMIN_ROLE();
    // OWNER_ROLE = await divingBoardTradeDeployContract.OWNER_ROLE();
    SIGNER_ROLE = await divingBoardTradeDeployContract.SIGNER_ROLE();

});

describe("DivingBoardTradeImpl", () => {

    describe("initialize", () => {
        it("should initialize", async () => {
            const DivingBoardTradeImpl = await ethers.getContractFactory("DivingBoardTradeImpl");
            await expect(upgrades.deployProxy(DivingBoardTradeImpl, [thresholdAmount, TREASURY.address, tokenName, symbol, ADMIN.address, OWNER_ROLE.address])).to.not.be.reverted;
        });

        it("should not initialize", async () => {
            await expect(divingBoardTradeDeployContract.initialize(thresholdAmount, TREASURY.address, tokenName, symbol, ADMIN.address, OWNER_ROLE.address)).to.be.reverted;
        });

        it("should initialize", async () => {
            await expect(divingBoardTradeDeployContract.initialize());
        });
        it("should not initialize with empty token name and symbol", async () => {
            await expect(divingBoardTradeDeployContract.initialize(thresholdAmount, TREASURY.address, "", "", ADMIN.address, OWNER_ROLE.address)).to.be.reverted;
        });
        it("should not initialize with zero treasury, admin and signer address", async () => {
            const DivingBoardTradeImpl = await ethers.getContractFactory("DivingBoardTradeImpl");
            await expect(upgrades.deployProxy(DivingBoardTradeImpl, [thresholdAmount, ZERO_ADDRESS, tokenName, symbol, ZERO_ADDRESS, ZERO_ADDRESS])).to.be.revertedWithCustomError(divingBoardTradeDeployContract,"AddressIsZeroAddress");
        });
    });

    describe("createTrade", () => {
        function encodeAndSignBidData(tradeId, trader, startTime, endTime, erc20Address, amount, tradeFee, reward, expiry, signerIndex) {
            let bidEncodedData = web3.eth.abi.encodeParameters(
                ['uint256', 'address', 'uint256', 'uint256', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
                [tradeId, trader, startTime, endTime, erc20Address, amount, tradeFee, reward, expiry]
            );
            const accounts = config.networks.hardhat.accounts;
            const index = signerIndex; // first wallet, increment for next wallets
            const wallet1 = ethers.Wallet.fromMnemonic(accounts.mnemonic, accounts.path + `/${index}`);
            const privateKey1 = wallet1.privateKey
            const messageHex = web3.utils.keccak256(bidEncodedData);
            const sign = web3.eth.accounts.sign(messageHex, privateKey1);
            const bidSignature = sign.signature;
            return { bidEncodedData, bidSignature }
        }
        describe("when caller is trader", () => {
            it("should create trade", async function () {
                const amount = 5;
                const tradeFee = 2;
                const reward = 1;
                const startTime = await latest();
                const endTime = (await latest() + 15);
                const expiry = (await latest() + 60);
                let authorizedSignerIndex = 0;
                const erc20Address = erc20.address;
                const { bidEncodedData, bidSignature } = encodeAndSignBidData(1, trader.address, startTime, endTime, erc20Address, amount, tradeFee, reward, expiry, authorizedSignerIndex);
                await erc20.connect(trader).approval(divingBoardTradeDeployContract.address, 100);
                await expect(divingBoardTradeDeployContract.connect(trader).createTrade(bidEncodedData, bidSignature, tokenMetadata))
                    .to.emit(divingBoardTradeDeployContract, EVENTS.TRADE_CREATED);
                tradeCount++
            });

            it("should not create trade when tokenMetadata is empty", async function () {
                const amount = 5;
                const tradeFee = 2;
                const reward = 1;
                const startTime = await latest();
                const endTime = (await latest() + 10);
                const expiry = (await latest() + 60);
                let authorizedSignerIndex = 0;
                const erc20Address = erc20.address;
                const { bidEncodedData, bidSignature } = encodeAndSignBidData(1, trader.address, startTime, endTime, erc20Address, amount, tradeFee, reward, expiry, authorizedSignerIndex);
                await erc20.connect(trader).approval(divingBoardTradeDeployContract.address, 100);
                await expect(divingBoardTradeDeployContract.connect(trader).createTrade(bidEncodedData, bidSignature, ""))
                    .to.be.revertedWith("String must not be empty");
                tradeCount++    
            });

            it("should not create trade when signature is expired", async function () {
                const amount = 5;
                const tradeFee = 2;
                const reward = 1;
                const startTime = await latest();
                const endTime = (await latest() + 60);
                const expiry = (await latest() - 60);
                let authorizedSignerIndex = 0;
                const erc20Address = erc20.address;
                const { bidEncodedData, bidSignature } = encodeAndSignBidData(1, trader.address, startTime, endTime, erc20Address, amount, tradeFee, reward, expiry, authorizedSignerIndex);
                let val = await erc20.connect(trader).approval(divingBoardTradeDeployContract.address, 50);
                await expect(
                    divingBoardTradeDeployContract.connect(trader).createTrade(bidEncodedData, bidSignature, tokenMetadata)
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract,"SignatureExpired");
            });

            it("should not create trade when signer is invalid", async function () {
                const amount = 5;
                const tradeFee = 2;
                const reward = 1;
                const startTime = await latest();
                const endTime = (await latest() + 60);
                const expiry = (await latest() + 60);
                let authorizedSignerIndex = 1;
                const erc20Address = erc20.address;
                const { bidEncodedData, bidSignature } = encodeAndSignBidData(tradeId-1, TREASURY.address, startTime, endTime, erc20Address, amount, tradeFee, reward, expiry, authorizedSignerIndex);
                await erc20.connect(trader).approval(divingBoardTradeDeployContract.address, 50);
                await expect(
                    divingBoardTradeDeployContract.connect(TREASURY).createTrade(bidEncodedData, bidSignature, tokenMetadata)
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract,"InvalidSigner");
            });

            it("should not create trade when trade already exist", async function () {
                const amount = 5;
                const tradeFee = 2;
                const reward = 1;
                const startTime = await latest();
                const endTime = (await latest() + 10);
                const expiry = (await latest() + 60);
                let authorizedSignerIndex = 0;
                const erc20Address = erc20.address;
                const { bidEncodedData, bidSignature } = encodeAndSignBidData(1, trader.address, startTime, endTime, erc20Address, amount, tradeFee, reward, expiry, authorizedSignerIndex);
                await erc20.connect(trader).approval(divingBoardTradeDeployContract.address, 100);
                await expect(divingBoardTradeDeployContract.connect(trader).createTrade(bidEncodedData, bidSignature, tokenMetadata))
                    .to.be.revertedWithCustomError(divingBoardTradeDeployContract,"TradeAlreadyExits");
                tradeCount++
            });

        });
        describe("when caller is not trader", () => {
            it("should not create trade when trader address is mismatch", async function () {
                const amount = 5;
                const tradeFee = 2;
                const reward = 1;
                const startTime = await latest();
                const endTime = (await latest() + 60);
                expiry = (await latest() + 60);
                let authorizedSignerIndex = 0;
                const erc20Address = erc20.address;
                const { bidEncodedData, bidSignature } = encodeAndSignBidData(1, trader.address, startTime, endTime, erc20Address, amount, tradeFee, reward, expiry, authorizedSignerIndex);
                erc20.connect(trader).approval(divingBoardTradeDeployContract.address, 50);
                await expect(
                    divingBoardTradeDeployContract.connect(MAX).createTrade(bidEncodedData, bidSignature, tokenMetadata)
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract,"TraderAddressMismatch");
            });
        });
    });

    describe("tokenURI", async () => {
        describe("when users try to get the uri", async () => {
            it("sholud return URI", async () => {
                const uri = await divingBoardTradeDeployContract.tokenURI(tradeId);
                expect(uri).to.equal(tokenMetadata);    
            });
        });
    });

    describe("checkTradeForResolution", () => {
        it("should check trade for resolution", async function () {
            expect(await divingBoardTradeDeployContract.checkTradeForResolution(tradeId)).to.be.true;
        });
    });

    describe("resolveTrade", () => {
        describe("when caller is admin", () => {

            it("should not resolve trade when trade is not expired", async function () {
                await expect(divingBoardTradeDeployContract.connect(ADMIN).resolveTrade([tradeId])
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract,"TradeNotExpired");
            });
        
            it("should not resolve trade when trade is not found", async function () {
                await new Promise(resolve => setTimeout(resolve, 2000));
                await expect(divingBoardTradeDeployContract.connect(ADMIN).resolveTrade([tradeId+1])
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract,"TradeNotFound");

            });

            it("should resolve trade", async function () {
                await new Promise(resolve => setTimeout(resolve, 5000));
                await expect(divingBoardTradeDeployContract.connect(ADMIN).resolveTrade([tradeId])
                ).to.emit(divingBoardTradeDeployContract, EVENTS.TRADE_RESOLVED);

            });

            it("trade already resolved", async function () {
                await new Promise(resolve => setTimeout(resolve, 2000));
                await expect(divingBoardTradeDeployContract.connect(ADMIN).resolveTrade([tradeId])
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract,"TradeNotCreatedOrResolved");
            });
        });

        describe("when caller is not admin", () => {
            it("should not resolve trade", async function () {
                await new Promise(resolve => setTimeout(resolve, 2000));
                await expect(divingBoardTradeDeployContract.connect(TREASURY).resolveTrade([tradeId])
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "CallerIsNotAdmin");

            });
        });

    });

    describe("createTrade", () => {
        function encodeAndSignBidData(tradeId, trader, startTime, endTime, erc20Address, amount, tradeFee, reward, expiry, signerIndex) {
            let bidEncodedData = web3.eth.abi.encodeParameters(
                ['uint256', 'address', 'uint256', 'uint256', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
                [tradeId, trader, startTime, endTime, erc20Address, amount, tradeFee, reward, expiry]
            );
            const accounts = config.networks.hardhat.accounts;
            const index = signerIndex; // first wallet, increment for next wallets
            const wallet1 = ethers.Wallet.fromMnemonic(accounts.mnemonic, accounts.path + `/${index}`);
            const privateKey1 = wallet1.privateKey
            const messageHex = web3.utils.keccak256(bidEncodedData);
            const sign = web3.eth.accounts.sign(messageHex, privateKey1);
            const bidSignature = sign.signature;
            return { bidEncodedData, bidSignature }
        }
        describe("when caller is trader", () => {
            it("should create trade", async function () {
                const amount = 5;
                const tradeFee = 2;
                const reward = 1;
                const startTime = await latest();
                const endTime = (await latest() + 5);
                const expiry = (await latest() + 60);
                let authorizedSignerIndex = 0;
                const erc20Address = erc20.address;
                const { bidEncodedData, bidSignature } = encodeAndSignBidData(tradeId + 1, trader.address, startTime, endTime, erc20Address, amount, tradeFee, reward, expiry, authorizedSignerIndex);
                await erc20.connect(trader).approval(divingBoardTradeDeployContract.address, 100);
                await expect(divingBoardTradeDeployContract.connect(trader).createTrade(bidEncodedData, bidSignature, tokenMetadata))
                    .to.emit(divingBoardTradeDeployContract, EVENTS.TRADE_CREATED);
                tradeCount++
            });
        });
    });

    describe("claimTrade", () => {
        function encodeAndSignBidData(tradeId, expiry, signerIndex) {
            let bidEncodedData = web3.eth.abi.encodeParameters(
                ['uint256[]', 'uint256'],
                [tradeId, expiry]
            );
            const accounts = config.networks.hardhat.accounts;
            const index = signerIndex; // first wallet, increment for next wallets
            const wallet1 = ethers.Wallet.fromMnemonic(accounts.mnemonic, accounts.path + `/${index}`);
            const privateKey1 = wallet1.privateKey
            const messageHex = web3.utils.keccak256(bidEncodedData);
            const sign = web3.eth.accounts.sign(messageHex, privateKey1);
            const bidSignature = sign.signature;
            return { bidEncodedData, bidSignature }
        }
        describe("when claimer is valid", () => {
            it("should not claim trade when trade is not found", async function () {
                const expiry = (await latest() + 60);
                let authorizedSignerIndex = 0;
                const { bidEncodedData, bidSignature } = encodeAndSignBidData([tradeId + 2], expiry, authorizedSignerIndex);
                await expect(divingBoardTradeDeployContract.connect(trader).claimTrade(bidEncodedData, bidSignature))
                .to.be.revertedWithCustomError(divingBoardTradeDeployContract,"TradeNotFound");
            });

            it("should not claim trade when trade not expired", async function () {
                const expiry = (await latest() + 60);
                let authorizedSignerIndex = 0;
                const { bidEncodedData, bidSignature } = encodeAndSignBidData([tradeId + 1], expiry, authorizedSignerIndex);
                await expect(divingBoardTradeDeployContract.connect(trader).claimTrade(bidEncodedData, bidSignature)
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract,"TradeNotExpired");

            });
            it("should claim trade", async function () {

                const expiry = (await latest() + 60);
                let authorizedSignerIndex = 0;
                const { bidEncodedData, bidSignature } = encodeAndSignBidData([tradeId + 1], expiry, authorizedSignerIndex);
                await new Promise(resolve => setTimeout(resolve, 3000));
                await expect(divingBoardTradeDeployContract.connect(trader).claimTrade(bidEncodedData, bidSignature))
                    .to.emit(divingBoardTradeDeployContract, EVENTS.REWARD_CLAIMED);
            });
            it("should not claim trade when signature is expired", async function () {
                const expiry = (await latest() - 60);
                let authorizedSignerIndex = 0;
                const { bidEncodedData, bidSignature } = encodeAndSignBidData([tradeId + 1], expiry, authorizedSignerIndex);
                await new Promise(resolve => setTimeout(resolve, 3000));
                await expect(divingBoardTradeDeployContract.connect(trader).claimTrade(bidEncodedData, bidSignature)
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract,"SignatureExpired");
            });
            it("should not claim trade when invalid signer", async function () {
                const expiry = (await latest() + 60);
                let authorizedSignerIndex = 1;
                const { bidEncodedData, bidSignature } = encodeAndSignBidData([tradeId + 1], expiry, authorizedSignerIndex);
                await new Promise(resolve => setTimeout(resolve, 3000));
                await expect(divingBoardTradeDeployContract.connect(trader).claimTrade(bidEncodedData, bidSignature)
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract,"InvalidSigner");
            });
            it("should not claim when caller not trader owner", async function () {
                const expiry = (await latest() + 60);
                let authorizedSignerIndex = 0;
                const { bidEncodedData, bidSignature } = encodeAndSignBidData([tradeId + 1], expiry, authorizedSignerIndex);
                await new Promise(resolve => setTimeout(resolve, 3000));
                await expect(divingBoardTradeDeployContract.connect(TREASURY).claimTrade(bidEncodedData, bidSignature)
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract,"TraderAddressMismatch");
            });
            it("should not claim when trade already claimed", async function () {
                const expiry = (await latest() + 60);
                let authorizedSignerIndex = 0;
                const { bidEncodedData, bidSignature } = encodeAndSignBidData([tradeId + 1], expiry, authorizedSignerIndex);
                await new Promise(resolve => setTimeout(resolve, 3000));
                await expect(divingBoardTradeDeployContract.connect(trader).claimTrade(bidEncodedData, bidSignature)
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract,"TradeAlreadyClaimed");
            });
        });
    });

    describe("updateThresholdAmount", () => {
        describe("when owner try to update thresholdAmount", () => {
            // let thresholdAmount = 1000000000000000;
            it("should not update thresholdAmount when same amount is given", async () => {
                await expect(divingBoardTradeDeployContract.connect(ADMIN).updateThresholdAmount(thresholdAmount)
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract,"SameValueAsPrevious");
            });
            it("should update thresholdAmount", async () => {
                let thresholdAmount = 100000;
                await expect(divingBoardTradeDeployContract.connect(ADMIN).updateThresholdAmount(thresholdAmount)).to.not.reverted;;
            });
          
        });
        describe("when other then owner try to update thresholdAmount", () => {
            it("should not update thresholdAmount", async () => {
                let thresholdAmount = 100000;
                await expect(divingBoardTradeDeployContract.connect(trader).updateThresholdAmount(thresholdAmount)
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "CallerIsNotAdmin");
            });
        })

    });

    describe("addAdmin", () => {
        it("should add a new admin", async () => {
            await divingBoardTradeDeployContract.connect(ADMIN).addAdmin(GEORGE.address);
            expect(await divingBoardTradeDeployContract.hasRole(ADMIN_ROLE, GEORGE.address)).to.be.true;
        });

        it("should revert if address is the zero address", async () => {
            await expect(
                divingBoardTradeDeployContract.connect(ADMIN).addAdmin(ZERO_ADDRESS)
            ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "AddressIsZeroAddress");
        });

        it("should revert if address is already admin", async () => {
            await expect(
                divingBoardTradeDeployContract.connect(ADMIN).addAdmin(GEORGE.address)
            ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "AddressAlreadyAdmin");
        });

        it("should not add Admin if caller is not admin", async () => {
            await expect(
                divingBoardTradeDeployContract.connect(TREASURY).addAdmin(GEORGE.address)
            ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "CallerIsNotAdmin");
        });

    });

    describe("removeAdmin", () => {
        it("should remove admin", async () => {
            await divingBoardTradeDeployContract.connect(ADMIN).removeAdmin(GEORGE.address);
            expect(await !divingBoardTradeDeployContract.hasRole(ADMIN_ROLE, GEORGE.address)).to.be.false;
        });

        it("address not a admin address", async () => {
            await expect(
                divingBoardTradeDeployContract.connect(ADMIN).removeAdmin(TREASURY.address)
            ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "AddressNotAdmin");
        });

        it("should not remove Admin if caller is not owner address", async () => {
            await expect(
                divingBoardTradeDeployContract.connect(TREASURY).removeAdmin(GEORGE.address)
            ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "CallerIsNotAdmin");
        });

    });

    describe("addSigner", () => {
        it("should add a new signer", async () => {
            await divingBoardTradeDeployContract.connect(ADMIN).addSigner(TOM.address);
            expect(await divingBoardTradeDeployContract.hasRole(SIGNER_ROLE, TOM.address)).to.be.true;
        });

        it("should revert if address is the zero address", async () => {
            await expect(
                divingBoardTradeDeployContract.connect(ADMIN).addSigner(ZERO_ADDRESS)
            ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "AddressIsZeroAddress");
        });

        it("should revert if address is already signer", async () => {
            await expect(
                divingBoardTradeDeployContract.connect(ADMIN).addSigner(TOM.address)
            ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "AddressAlreadySigner");
        });

        it("should not add signer if caller is not admin", async () => {
            await expect(
                divingBoardTradeDeployContract.connect(TREASURY).addSigner(TOM.address)
            ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "CallerIsNotAdmin");
        });

    });

    describe("removeSigner", () => {
        it("should remove a signer", async () => {
            await divingBoardTradeDeployContract.connect(ADMIN).removeSigner(TOM.address);
            expect(await !divingBoardTradeDeployContract.hasRole(SIGNER_ROLE, TOM.address)).to.be.false;
        });

        it("address not a signer address", async () => {
            await expect(
                divingBoardTradeDeployContract.connect(ADMIN).removeSigner(TREASURY.address)
            ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "AddressNotSigner");
        });

        it("should not remove signer if caller is not admin address", async () => {
            await expect(
                divingBoardTradeDeployContract.connect(TREASURY).removeSigner(TOM.address)
            ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "CallerIsNotAdmin");
        });

    });

    describe("withdrawTokens", () => {
        describe("when owner try to withdrawTokens", () => {
            let amount = 10;
            it("should withdraw token", async () => {
                await erc20.mint(divingBoardTradeDeployContract.address, 100000)
                await expect(divingBoardTradeDeployContract.connect(ADMIN).withdrawTokens(erc20.address, amount)).to.not.reverted;;
            });
            it("should not when token is zero address", async () => {
                await expect(divingBoardTradeDeployContract.connect(ADMIN).withdrawTokens(ZERO_ADDRESS,amount)
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract,"AddressIsZeroAddress");
            });

        });
        describe("should not withdraw when other then owner try to withdrawTokens", () => {
            it("should not withdraw token", async () => {
                let amount = 10;
                await expect(divingBoardTradeDeployContract.connect(TREASURY).withdrawTokens(erc20.address, amount)
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "CallerIsNotAdmin");
            });

        });

    });

    describe("pause", () => {

        describe("when user attempts to pause the functionality", async function () {
            it("should not be able to pause", async () => {
                await expect(divingBoardTradeDeployContract.connect(TREASURY).pause()
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "CallerIsNotAdmin");
            });
        });

        describe("when admin attempts to pause the functionality", function () {
            // it("should be unpause contract before pausing contract", async () => {
            //     expect(await divingBoardTradeDeployContract.connect(ADMIN).pause()).to.be.false;
            // });
            it("should be able to pause", async () => {
                await expect(divingBoardTradeDeployContract.connect(ADMIN).pause()).to.be.not.reverted;
            });
        });

        describe("when contract is paused ", function () {
            it("should not add admin", async () => {
                await expect(divingBoardTradeDeployContract.connect(ADMIN).addAdmin(JENNIFER.address)
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "EnforcedPause");
            });

            it("should not remove admin", async () => {
                await expect(divingBoardTradeDeployContract.connect(ADMIN).removeAdmin(JENNIFER.address)
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "EnforcedPause");
            });

            it("should not add signer", async () => {
                await expect(divingBoardTradeDeployContract.connect(ADMIN).addSigner(TREASURY.address)
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "EnforcedPause");
            });

            it("should not remove signer", async () => {
                await expect(divingBoardTradeDeployContract.connect(ADMIN).removeSigner(TREASURY.address)
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "EnforcedPause");
            });

            it("should not withdraw tokens", async () => {
                let amount = 10;
                await expect(divingBoardTradeDeployContract.connect(ADMIN).withdrawTokens(erc20.address, amount)
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "EnforcedPause");
            });
            it("should not update thresholdAmount", async () => {
                let thresholdAmount = 100000;
                await expect(divingBoardTradeDeployContract.connect(ADMIN).updateThresholdAmount(thresholdAmount)).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "EnforcedPause");
            });
            it("should not claim trade", async function () {
                function encodeAndSignBidData(tradeId, expiry, signerIndex) {
                    let bidEncodedData = web3.eth.abi.encodeParameters(
                        ['uint256[]', 'uint256'],
                        [tradeId, expiry]
                    );
                    const accounts = config.networks.hardhat.accounts;
                    const index = signerIndex; // first wallet, increment for next wallets
                    const wallet1 = ethers.Wallet.fromMnemonic(accounts.mnemonic, accounts.path + `/${index}`);
                    const privateKey1 = wallet1.privateKey
                    const messageHex = web3.utils.keccak256(bidEncodedData);
                    const sign = web3.eth.accounts.sign(messageHex, privateKey1);
                    const bidSignature = sign.signature;
                    return { bidEncodedData, bidSignature }
                }
                const expiry = (await latest() + 60);
                let authorizedSignerIndex = 0;
                const { bidEncodedData, bidSignature } = encodeAndSignBidData([tradeId + 1], expiry, authorizedSignerIndex);
                await new Promise(resolve => setTimeout(resolve, 3000));
                await expect(divingBoardTradeDeployContract.connect(trader).claimTrade(bidEncodedData, bidSignature)).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "EnforcedPause");
            });
            it("should not resolve trade", async function () {
                await new Promise(resolve => setTimeout(resolve, 2000));
                await expect(divingBoardTradeDeployContract.connect(ADMIN).resolveTrade([tradeId+2])).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "EnforcedPause");
            });
            it("should not create trade", async function () {
                function encodeAndSignBidData(tradeId, trader, startTime, endTime, erc20Address, amount, tradeFee, reward, expiry, signerIndex) {
                    let bidEncodedData = web3.eth.abi.encodeParameters(
                        ['uint256', 'address', 'uint256', 'uint256', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
                        [tradeId, trader, startTime, endTime, erc20Address, amount, tradeFee, reward, expiry]
                    );
                    const accounts = config.networks.hardhat.accounts;
                    const index = signerIndex; // first wallet, increment for next wallets
                    const wallet1 = ethers.Wallet.fromMnemonic(accounts.mnemonic, accounts.path + `/${index}`);
                    const privateKey1 = wallet1.privateKey
                    const messageHex = web3.utils.keccak256(bidEncodedData);
                    const sign = web3.eth.accounts.sign(messageHex, privateKey1);
                    const bidSignature = sign.signature;
                    return { bidEncodedData, bidSignature }
                }
                const amount = 5;
                const tradeFee = 2;
                const reward = 1;
                const startTime = await latest();
                const endTime = (await latest() + 10);
                const expiry = (await latest() + 60);
                let authorizedSignerIndex = 0;
                const erc20Address = erc20.address;
                const { bidEncodedData, bidSignature } = encodeAndSignBidData(tradeId+3, trader.address, startTime, endTime, erc20Address, amount, tradeFee, reward, expiry, authorizedSignerIndex);
                await erc20.connect(trader).approval(divingBoardTradeDeployContract.address, 100);
                await expect(divingBoardTradeDeployContract.connect(trader).createTrade(bidEncodedData, bidSignature, tokenMetadata)).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "EnforcedPause");
            });

        });
    });

    describe("unpause", () => {
        describe("when user attempts to unpause the functionality", async function () {
            it("should not be able to unpause", async () => {
                await expect(divingBoardTradeDeployContract.connect(MAX).unpause()
                ).to.be.revertedWithCustomError(divingBoardTradeDeployContract, "CallerIsNotAdmin");
            });
        });

        describe("when owner attempts to unpause the functionality", function () {
            it("should be able to unpause", async () => {
                await expect(divingBoardTradeDeployContract.connect(ADMIN).unpause()).to.be.not.reverted;
            });
        });
    });

    describe("supportsInterface", () => {
        it("should support ERC721 interface", async () => {
          const interfaceId = "0x80ac58cd";
          const supportsERC721 = await divingBoardTradeDeployContract.supportsInterface(interfaceId);
          expect(supportsERC721).to.be.true;
        });
      
        it("should support AccessControl interface", async () => {
          const interfaceId = "0x01ffc9a7";
          const supportsAccessControl = await divingBoardTradeDeployContract.supportsInterface(interfaceId);
          expect(supportsAccessControl).to.be.true;
        });
      
        it("should not support other interfaces", async () => {
          const otherInterfaceId = "0x12345678"; // Example of another interface ID
          const supportsOther = await divingBoardTradeDeployContract.supportsInterface(otherInterfaceId);
          expect(supportsOther).to.be.false;
        });
    });


});
