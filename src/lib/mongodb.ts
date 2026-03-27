import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error("MONGODB_URI belum diset.");
}

type GlobalWithMongo = typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

const globalWithMongo = globalThis as GlobalWithMongo;

const client = new MongoClient(uri);
const clientPromise = globalWithMongo._mongoClientPromise ?? client.connect();

if (process.env.NODE_ENV !== "production") {
  globalWithMongo._mongoClientPromise = clientPromise;
}

export default clientPromise;
