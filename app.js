const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const fs = require('fs'); 

const app = express();
app.use(bodyParser.json());

// Serve static files from the 'public' directory
app.use(express.static('public'));

class Block {
    constructor(index, timestamp, voterHash, candidate, previousHash = '') {
        this.index = index;
        this.timestamp = timestamp;
        this.voterHash = voterHash;
        this.candidate = candidate;
        this.previousHash = previousHash;
        this.hash = this.calculateHash();
    }

    calculateHash() {
        return crypto.createHash('sha256').update(this.index + this.previousHash + this.timestamp + this.voterHash + this.candidate).digest('hex');
    }
}

class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()];
    }

    createGenesisBlock() {
        return new Block(0, Date.now(), "0", "Genesis Block", "0");
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    addBlock(newBlock) {
        newBlock.previousHash = this.getLatestBlock().hash;
        newBlock.hash = newBlock.calculateHash();
        this.chain.push(newBlock);
    }

    isChainValid() {
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            if (currentBlock.hash !== currentBlock.calculateHash()) {
                return false;
            }

            if (currentBlock.previousHash !== previousBlock.hash) {
                return false;
            }
        }

        return true;
    }

    hasVoterAlreadyVoted(voterHash) {
        return this.chain.some(block => block.voterHash === voterHash);
    }
}

// Initialize blockchain
const voteChain = new Blockchain();

// In-memory storage for registered voters
const voters = {};

app.post('/register', (req, res) => {
    const voterId = req.body.voter_id;
    if (!voterId) {
        return res.status(400).json({ error: 'Voter ID is required' });
    }

    const voterHash = crypto.createHash('sha256').update(voterId).digest('hex');
    if (voters[voterHash]) {
        return res.status(400).json({ error: 'Voter already registered' });
    }

    voters[voterHash] = true;
    res.status(201).json({ message: 'Voter registered successfully' });
});

app.post('/vote', (req, res) => {
    const voterId = req.body.voter_id;
    const candidate = req.body.candidate;

    if (!voterId || !candidate) {
        return res.status(400).json({ error: 'Voter ID and candidate are required' });
    }

    const voterHash = crypto.createHash('sha256').update(voterId).digest('hex');
    if (!voters[voterHash]) {
        return res.status(403).json({ error: 'Voter not registered' });
    }

    if (voteChain.hasVoterAlreadyVoted(voterHash)) {
        return res.status(403).json({ error: 'Voter has already voted' });
    }

    const newBlock = new Block(voteChain.chain.length, Date.now(), voterHash, candidate);
    voteChain.addBlock(newBlock);

    // Write the block data to a JSON file
    const blockData = {
        index: newBlock.index,
        timestamp: newBlock.timestamp,
        voterHash: newBlock.voterHash,
        candidate: newBlock.candidate,
        previousHash: newBlock.previousHash,
        hash: newBlock.hash
    };

    fs.readFile('votes.json', (err, data) => {
        let votes = [];
        if (!err) {
            votes = JSON.parse(data);
        }
        votes.push(blockData);

        fs.writeFile('votes.json', JSON.stringify(votes, null, 4), (err) => {
            if (err) throw err;
            console.log('Vote hash saved to votes.json');
        });
    });

    res.status(200).json({ message: 'Vote cast successfully' });
});

// Serve the static index.html for the root URL
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.listen(3000, () => {
    console.log('Voting system listening on port 3000');
});
