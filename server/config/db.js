const mongoose = require('mongoose');

let mongoMemoryServer = null;

const connectDB = async () => {
  let mongoUri = process.env.MONGO_URI;

  if (mongoUri && mongoUri !== 'memory') {
    try {
      console.log(`[Database] Attempting connection to MongoDB at: ${mongoUri}`);
      const conn = await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 3000,
      });
      console.log(`[Database] MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
      return conn;
    } catch (err) {
      console.warn(`[Database] Could not connect to external MongoDB (${err.message}).`);
      console.log(`[Database] Falling back to embedded MongoMemoryServer for reliable execution...`);
    }
  }

  // Fallback or explicit in-memory MongoDB
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoMemoryServer = await MongoMemoryServer.create();
    const uri = mongoMemoryServer.getUri();
    const conn = await mongoose.connect(uri);
    console.log(`[Database] Connected to embedded MongoDB at: ${uri}`);
    return conn;
  } catch (memErr) {
    console.error(`[Database] Critical error initializing database: ${memErr.message}`);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    if (mongoMemoryServer) {
      await mongoMemoryServer.stop();
    }
  } catch (err) {
    console.error(`[Database] Disconnect Error: ${err.message}`);
  }
};

module.exports = { connectDB, disconnectDB };
