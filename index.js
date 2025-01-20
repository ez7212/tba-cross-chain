import { TokenboundClient } from "@tokenbound/sdk";
import { ethers } from "ethers";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Etherfi claim function ABI (only the function we need)
const CLAIM_ABI = [
    "function claim(uint256 index, address account, uint256 amount, bytes32[] calldata merkleProof) external"
];

async function fetchClaimData(address) {
    try {
        const response = await fetch(`https://claim.ether.fi/api/eigenlayer-claim-data?address=${address}`);
        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        throw new Error(`Failed to fetch claim data: ${error.message}`);
    }
}

async function initializeTokenbound() {
    // Initialize provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    // Initialize TokenboundClient
    const tokenboundClient = new TokenboundClient({
        signer: wallet,
        chainId: 42161
    });

    return { tokenboundClient, provider, wallet };
}

async function prepareCrossChainTransaction(tokenboundClient, claimData, tbaAddress) {
    // Create interface for the claim contract
    const claimInterface = new ethers.utils.Interface(CLAIM_ABI);

    // Convert amount from string to BigNumber
    const amount = ethers.BigNumber.from(claimData.amount);

    // Encode the claim function call
    const encodedClaimFunction = claimInterface.encodeFunctionData("claim", [
        claimData.index,
        tbaAddress,
        amount,
        claimData.proof
    ]);

    // Get the execution details
    const executionDetails = await tokenboundClient.prepareExecution({
        account: tbaAddress,
        to: "0x2ec90ef34e312a855becf74762d198d8369eece1", // EigenLayer claim contract
        value: "0",
        data: encodedClaimFunction,
        chainId: 1
    });

    console.log(executionDetails);
}


async function main() {
    try {
        // Initialize clients
        const { tokenboundClient, wallet } = await initializeTokenbound();
        console.log("Initialized with wallet address:", await wallet.getAddress());

        // Get TBA address
        const tbaAddress = await tokenboundClient.getAccount({
            tokenContract: "0xd022977a22f9a681Df8F3c51ed9ad144BDc5bb38",
            tokenId: 539,
        });
        console.log("TBA Address:", tbaAddress);

        // Fetch claim data for the TBA
        console.log("Fetching claim data...");
        const claimData = await fetchClaimData(tbaAddress);
        console.log("Claim data received:", claimData);

        // Prepare the cross-chain transaction
        console.log("Preparing cross-chain transaction...");
        const executionParams = await prepareCrossChainTransaction(tokenboundClient, claimData, tbaAddress);

        // // Execute cross-chain transaction through TBA
        // console.log("Executing cross-chain transaction...");
        // const tx = await tokenboundClient.execute({
        //     account: tbaAddress,
        //     to: executionParams.to,
        //     value: executionParams.value,
        //     data: executionParams.data,
        //     destinationChainId: 1  // Ethereum mainnet
        // });

        // console.log("Transaction hash:", tx.hash);

        // // Wait for confirmation
        // const receipt = await tx.wait();
        // console.log("Transaction confirmed in block:", receipt.blockNumber);

    } catch (error) {
        console.error("Error:", error.message);
        if (error.error && error.error.message) {
            console.error("Provider error:", error.error.message);
        }
        process.exit(1);
    }
}

// Execute main function
main().catch(console.error);