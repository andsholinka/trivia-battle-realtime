import { MongoClient, MongoClientOptions } from "mongodb";

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

    const options: MongoClientOptions = {
      // Tambahkan timeout dan retry options
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // Untuk mengatasi masalah DNS di Windows
      family: 4, // Force IPv4
    };

    const client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }

  return globalWithMongo._mongoClientPromise;
}
