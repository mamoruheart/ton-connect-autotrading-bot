// eslint-disable-next-line @typescript-eslint/no-redeclare
import mongoose, { Schema, Document, Model, ObjectId } from 'mongoose';

// Define interfaces
export interface OrderingData {
  _id: mongoose.Types.ObjectId; // Add _id field
  state: string;
  jettons: string[];
  mainCoin: number;
  amount: number;
  price: number; // toJetton x amount = $fromJetton
  isBuy: boolean;
  dex: string;
  mode: string;
  walletSecretKey: string;
}

export interface User extends Document {
  telegramID: number;
  walletAddress: string;
  secretKey: string;
  mode: string;
  wallets: string[];
  state: OrderingData;
  orderingData?: OrderingData[];
}

export interface Pool extends Document {
  caption: string[];
  address: string;
  lt: string;
  totalSupply: number;
  type: string;
  tradeFee: number;
  prices: number[];
  assets: string[];
  reserves: number[];
  fees: number[];
  volume: bigint[];
  decimals: number[];
  TVL: number;
  main: number;
  dex: string;
}

export interface AltToken extends Document {
  address: string;
  name: string;
  symbol: string;
  image: string;
  dex: string;
  decimals: number;
}
// MongoDB connection URI
const uri = 'mongodb://127.0.0.1:27017/';

// Connect to MongoDB
export async function connect(): Promise<typeof mongoose> {
  return mongoose.connect(uri, { tls: false });
}

// Define Mongoose schemas
const orderingDataSchema = new Schema<OrderingData>({
  jettons: [String],
  mainCoin: Number,
  amount: Number,
  price: Number,
  isBuy: Boolean,
  state: String,
  dex: String,
  walletSecretKey: String,
  mode: String
});

const altTokenSchema = new Schema<AltToken>({
  address: String,
  name: String,
  symbol: String,
  image: String,
  dex: String,
  decimals: Number
});

const userSchema = new Schema<User>({
  telegramID: Number,
  walletAddress: String,
  secretKey: String,
  mode: String,
  wallets: [String],
  state: orderingDataSchema,
  orderingData: [orderingDataSchema]
});

const poolSchema = new Schema<Pool>({
  caption: [String],
  address: String,
  lt: String,
  totalSupply: Number,
  type: String,
  tradeFee: Number,
  prices: [Number],
  assets: [String],
  reserves: [Number],
  fees: [Number],
  volume: [mongoose.Schema.Types.BigInt],
  decimals: [Number],
  TVL: Number,
  main: Number,
  dex: String
});

// Define Mongoose models
export const UserModel: Model<User> = mongoose.model<User>('User', userSchema);
export const PoolModel: Model<Pool> = mongoose.model<Pool>('Pool', poolSchema);
export const AltTokenModel: Model<AltToken> = mongoose.model<AltToken>('AltToken', altTokenSchema);
//update user states
export async function updateUserState(telegramID: number, newState: OrderingData): Promise<void> {
  await UserModel.updateOne({ telegramID }, { $set: { state: newState } });
}
//update wallet addres and secretkey
export async function updateWallet(
  telegramID: number,
  walletAddress: string,
  secretKey: string
): Promise<void> {
  await UserModel.updateOne({ telegramID }, { $set: { walletAddress, secretKey } });
}

//delete specified wallet address and secretkey
export async function deleteWalletSecret(telegramID: number, secretKey: string): Promise<void> {
  await UserModel.updateOne({ telegramID }, { $pull: { wallets: secretKey } });
}
//update user mode
export async function updateUserMode(telegramID: number, newMode: string): Promise<void> {
  await UserModel.updateOne({ telegramID }, { $set: { mode: newMode } });
}

// Create a new user
export async function createUser(user: User): Promise<User> {
  return UserModel.create(user);
}

// Get a user by Telegram ID
export async function getUserByTelegramID(telegramID: number): Promise<User | null> {
  return UserModel.findOne({ telegramID });
}

// Get all users
export async function getAllUsers(): Promise<User[]> {
  return UserModel.find({});
}

// Add ordering data to a user
export async function addOrderingDataToUser(
  telegramID: number,
  orderingData: OrderingData
): Promise<void> {
  await UserModel.updateOne({ telegramID }, { $push: { orderingData } });
}

// Add ordering data to a user
export async function addNewWalletToUser(telegramID: number, wallets: string): Promise<void> {
  await UserModel.updateOne({ telegramID }, { $push: { wallets } });
}

// Delete ordering data from a user
export async function deleteOrderingDataFromUser(
  telegramID: number,
  orderingDataId: mongoose.Types.ObjectId
): Promise<void> {
  await UserModel.updateOne({ telegramID }, { $pull: { orderingData: { _id: orderingDataId } } });
}

// Get a user by Telegram ID with ordering data
export async function getUserByTelegramIDWithOrderingData(
  telegramID: number
): Promise<User | null> {
  const user = await UserModel.findOne({ telegramID }).select('+orderingData');
  return user ? (user.toObject() as User) : null;
}
export async function getPoolByddress(address: string): Promise<Pool | null> {
  return PoolModel.findOne({ address });
}
// Create a new pool
export async function createPool(pool: Pool): Promise<Pool> {
  return PoolModel.create(pool);
}

// Get a pool by caption
export async function getPoolWithCaption(caption: string[], dex: string): Promise<Pool | null> {
  return PoolModel.findOne({ caption, dex });
}

// Get all pools
export async function getPools(): Promise<Pool[]> {
  return PoolModel.find({});
}

// Delete the pools collection
export async function deletePoolsCollection(): Promise<void> {
  await PoolModel.deleteMany({});
}
// Create a new pool
export async function createAltToken(altToken: AltToken): Promise<AltToken> {
  return AltTokenModel.create(altToken);
}

// Get a pool by caption
export async function getAltTokenWithAddress(
  address: string,
  dex: string
): Promise<AltToken | null> {
  return AltTokenModel.findOne({ address, dex });
}

export async function getAltTokenWithSymbol(symbol: string, dex: string): Promise<AltToken | null> {
  return AltTokenModel.findOne({ symbol, dex });
}

// Get all pools
export async function getAltTokens(dex: string): Promise<AltToken[]> {
  return AltTokenModel.find({ dex });
}

// Delete the pools collection
export async function deleteAltTokensCollection(): Promise<void> {
  await AltTokenModel.deleteMany({});
}
