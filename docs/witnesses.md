# Witnesses
The role of a witness in Breeze Blockchain is to verify incoming transactions and produce blocks when scheduled. Witnesses have no role in governance as breeze blockchain is entirely run by a DAO system. Witnesses get rewarded for the block production. Only top voted witnesses are eligble for block production. To be on top you need user upvotes which is not dependent on token staking.

# Witness Hardware
As of mainnet launch, we do not need high resources.
* CPU 2+ Cores
* RAM 4GB
* Storage 80+GB

# Witness Setup Procedure
It is recommended to use either Debian 10 or Ubuntu 20.04.

```bash
sudo apt-get update
sudo apt-get upgrade
sudo apt-get install git wget tmux htop jq unzip
git clone https://github.com/breeze-foundation/breeze.git
cd breeze/
```

Install NodeJS + NPM
```bash
sudo apt install npm
sudo apt install nodejs
```

Check node version with `node -v`. Breeze runs with node v14 and v16 only. If older version is installed, then update it:
```bash
curl -sL https://deb.nodesource.com/setup_16.x | sudo bash -
sudo apt install -y nodejs
```

And install NPM modules that Breeze uses.
```bash
npm install
```

Now install MongoDB:
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
```

Enable and start MongoDB deamon:
```
sudo systemctl enable mongod
sudo systemctl start mongod
```

##### Now you should be able to launch a breeze development chain by running the node with `./scripts/start.sh`.


# Sync your Breeze node
To sync your node to the mainnet, follow following steps


First, add some peers so you can connect to mainnet. (more peers on wtiness channel in [discord](https://discord.gg/eMfdUbkYHu))
`nano scripts/start.sh` add near the bottom

```bash
export PEERS=ws://144.126.142.1:6001,ws://75.119.135.167:6001,ws://135.181.133.50:6001
export MAX_PEERS=20
```

Next step is to specify the path to the folder containing `blocks.bson` file in `BLOCKS_DIR`, which is a read and append only file that stores all blocks.
Define the path in `/scripts/start.sh` file.

```bash
export BLOCKS_DIR=/path/to/blocks/dir
```

Final step is to replay chain. 
If your database has any data, wipe it. 
You can wipe the mongodb by doing `mongo breeze` (assuming you are using the default 'breeze' db name) and then `db.dropDatabase()` once inside the mongo cli tool.

## 1- Natural replay
This is the easiest method. Just start the node with `./scripts/start.sh` and you should see your node unzipping the genesis data, and then starting to download blocks from the peers. This method can be very slow, and probably not scalable in the long term.

## 2- Replay from blocks BSON file
This is the fastest method that reverifies locally all the past blocks and transactions, and therefore the current blockchain state. You need to download the `blocks.bson` file into the folder specified in `BLOCKS_DIR` env var:

```bash
cd /path/to/blocks/dir
wget -c https://backup.breezechain.org/blocks.bson
```

Now go back to main breeze directory and give permission to file `scripts/start.sh`

```bash
cd breeze
chmod +x scripts/start.sh
REBUILD_STATE=1 ./scripts/start.sh
```

A file named `blocks.index` will be constructed (if not already exists) which stores the pointers to each block in `blocks.bson`. This may take a few minutes.

Finally restart node.

##### If you want to start producing blocks on breeze as a witness, your account will need to define a witness key. Generate one into a file with `node src/cli key > witness-key.json`

Follow these simple steps to become witness
* First enter your username, public witness key, and private witness key near the bottom of the `scripts/start.sh` file

* and then start your node
```./scripts/start.sh```

* Next associate your public witness key with your account by using the on-chain transaction.
```bash
node src/cli enable-node YOUR_WITNESS_PUB_KEY -M YOUR_USERNAME -K YOUR_PRIVATE_KEY
```
* Next approve your witness node
```bash
node src/cli vote-witness YOUR_WITNESS_USERNAME -M YOUR_USERNAME -K YOUR_KEY
```
This transaction must be signed with your master key or a custom key that allows this transaction. Once this step is done, you can head to the [witness](https://tipmeacoffee.com/witnesses) and vote yourself.
Once you get enough votes to be in top witnesses you will start producing blocks regularly and get rewarded for being a witness.

* Finally announce your witnesses node in our social channels and tell users why they should upvote you as witness
