import { MongoClient } from "mongodb";

type GlobalWithMongo = typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

const globalWithMongo = globalThis as GlobalWithMongo;

export default function getMongoClientPromise() {
  if (!globalWithMongo._mongoClientPromise) {
    const uri = process.env.MONGODB_URI;

    if (!uri) {
      throw new Error("MONGODB_URI belum diset.");
    }

    const client = new MongoClient(uri);
    globalWithMongo._mongoClientPromise = client.connect();
  }

  return globalWithMongo._mongoClientPromise;
}
