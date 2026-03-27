import { MongoClient } from "mongodb";

type GlobalWithMongo = typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

const globalWithMongo = globalThis as GlobalWithMongo;

function createClientPromise() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI belum diset.");
  }

  const client = new MongoClient(uri);
  return client.connect();
}

const clientPromise = globalWithMongo._mongoClientPromise ?? createClientPromise();

if (process.env.NODE_ENV !== "production") {
  globalWithMongo._mongoClientPromise = clientPromise;
}

export default clientPromise;
