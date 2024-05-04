require("@nomicfoundation/hardhat-toolbox");
require('dotenv').config();

/** @type import('hardhat/config').HardhatUserConfig */

const COMPILER_SETTINGS = {
  optimizer: {
    enabled: true,
    runs: 2000,
  },
  metadata: {
    bytecodeHash: 'none',
  },
}

module.exports = {
  plugins: ["@openzeppelin/hardhat-upgrades"],
  gasReporter: {
    currency: 'CHF',
    gasPrice: 21,
    enabled: true
  },
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      gas: 2100000,
      gasPrice: 8000000000,
    },

    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_PROJECT_ID}`,
      accounts: [process.env.PRIVATE_KEY]
    },
  },

  solidity: {
    compilers: [
      {
        version: '0.4.18',
        settings: COMPILER_SETTINGS,
      },
      {
        version: '0.8.20',
        settings: COMPILER_SETTINGS,
      },
      {
        version: '0.8.18',
        settings: COMPILER_SETTINGS,
      },
    ],
  },

  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  },

};