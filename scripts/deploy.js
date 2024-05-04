const { ethers } = require("hardhat");
require('dotenv').config();

async function main() {
    const oracleAddress = process.env.ORACLE_ADDRESS;
    const tokenName = process.env.TOKEN_NAME;
    const symbol = process.env.SYMBOL;
    const goldCoinDeploy = await ethers.getContractFactory("GoldCoin");
    const goldCoinDeployedImp = await goldCoinDeploy.deploy(oracleAddress,tokenName,symbol);
    await goldCoinDeployedImp.deployed();
    console.log("DivingBoardTradeImpl deployed to:", goldCoinDeployedImp.address);
}

main();

