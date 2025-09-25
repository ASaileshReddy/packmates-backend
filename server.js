const dotenv = require('dotenv').config();
var env = process.env.NODE_ENV || 'development';
var config = require('./config/dbconfig')[env];
const express = require('express');
const mongoose = require('mongoose');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || config.server.port;

// Middleware
app.use(cors({
  origin: true, // Allow all origins for external access
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// MongoDB connection
const atlasUri = "mongodb+srv://aditya_db_user:xivPUShPZ0xDfOkh@packmates.n1gtnjj.mongodb.net/?retryWrites=true&w=majority&appName=Packmates";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(atlasUri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Connect using native MongoDB driver
async function connectToMongoDB() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

// Also connect using Mongoose for model operations
mongoose.connect(atlasUri, { dbName: 'packmates' })
  .then(async () => {
    console.log('Connected to MongoDB via Mongoose');
    console.log('Database:', mongoose.connection.db.databaseName);
    
    // Force create collections immediately with explicit options
    try {
      await mongoose.connection.db.createCollection('users', {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["firstname", "lastname", "email", "passwordHash"],
            properties: {
              firstname: { bsonType: "string" },
              lastname: { bsonType: "string" },
              email: { bsonType: "string" },
              passwordHash: { bsonType: "string" }
            }
          }
        }
      });
      console.log('✅ Users collection created in packmates database');
    } catch (error) {
      console.log('Users collection already exists or error:', error.message);
    }
    
    try {
      await mongoose.connection.db.createCollection('pets', {
        validator: {
          $jsonSchema: {
            bsonType: "object",
            required: ["ownerId", "petType", "breed", "gender", "age", "weightKg"],
            properties: {
              ownerId: { bsonType: "objectId" },
              petType: { bsonType: "string" },
              breed: { bsonType: "string" },
              gender: { bsonType: "string" },
              weightKg: { bsonType: "number" }
            }
          }
        }
      });
      console.log('✅ Pets collection created in packmates database');
    } catch (error) {
      console.log('Pets collection already exists or error:', error.message);
    }
    
    // Insert a test document to ensure collections are visible
    try {
      const User = require('./api/user/models/user.model');
      const testUser = new User({
        firstname: "Test",
        lastname: "User",
        email: "test@example.com",
        passwordHash: "testhash123"
      });
      await testUser.save();
      console.log('✅ Test user inserted to ensure users collection is visible');
      
      // Delete the test user
      await User.deleteOne({ email: "test@example.com" });
      console.log('✅ Test user removed');
    } catch (error) {
      console.log('Error with test user:', error.message);
    }
    
    // List all collections to verify
    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      console.log('📋 Available collections:', collections.map(c => c.name));
    } catch (error) {
      console.log('Error listing collections:', error.message);
    }

    // Ensure collections are visible in Compass by inserting seed docs
    try {
      const usersCol = mongoose.connection.db.collection('users');
      const petsCol = mongoose.connection.db.collection('pets');

      // Check if documents already exist before inserting
      const existingUser = await usersCol.findOne({ email: 'packmates@example.com' });
      if (!existingUser) {
        await usersCol.insertOne({
          firstname: 'PackMates',
          lastname: 'User',
          email: 'packmates@example.com',
          passwordHash: 'visible-hash-123',
          createdAt: new Date(),
          updatedAt: new Date(),
          _visible: true
        });
        console.log('🌱 Inserted visible document into users collection');
      } else {
        console.log('✅ Users collection already has visible documents');
      }

      const existingPet = await petsCol.findOne({ breed: 'Golden Retriever' });
      if (!existingPet) {
        const ownerId = new (require('mongoose').Types.ObjectId)();
        await petsCol.insertOne({
          ownerId,
          petType: 'Dog',
          breed: 'Golden Retriever',
          gender: 'Male',
          age: { label: 'Adult', months: 24 },
          weightKg: 15.5,
          isDeleted: false,
          userId: ownerId,
          createdAt: new Date(),
          updatedAt: new Date(),
          _visible: true
        });
        console.log('🌱 Inserted visible document into pets collection');
      } else {
        console.log('✅ Pets collection already has visible documents');
      }
      
      // Show document counts
      const usersCount = await usersCol.countDocuments();
      const petsCount = await petsCol.countDocuments();
      console.log(`📊 Document counts - Users: ${usersCount}, Pets: ${petsCount}`);
      
    } catch (error) {
      console.log('Seeding error:', error.message);
    }
  })
  .catch((error) => {
    console.error('Mongoose connection error:', error);
  });

// Initialize MongoDB connection
connectToMongoDB();

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: 'PackMates API Server is running!',
    version: '1.0.0',
    status: 'OK'
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    message: 'PackMates API is running!'
  });
});

// Database test route
app.get('/test-db', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const usersCount = await db.collection('users').countDocuments();
    const petsCount = await db.collection('pets').countDocuments();
    
    res.json({
      status: 'OK',
      database: db.databaseName,
      collections: collections.map(c => c.name),
      documentCounts: {
        users: usersCount,
        pets: petsCount
      },
      message: 'Database connection and collections are working!'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Database test failed',
      error: error.message
    });
  }
});

// Troubleshooting endpoint
app.get('/debug', (req, res) => {
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  const addresses = [];
  
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          interface: interfaceName,
          address: iface.address,
          url: `http://${iface.address}:${PORT}`
        });
      }
    }
  }
  
  res.json({
    server: {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: os.platform()
    },
    network: {
      localAddresses: addresses,
      localhost: `http://localhost:${PORT}`,
      externalAccess: `http://103.42.248.224:${PORT}`,
      troubleshooting: {
        step1: 'Test local access first: http://localhost:3000/health',
        step2: 'Test network access: http://[your-local-ip]:3000/health',
        step3: 'Configure router port forwarding: 3000 → 3000',
        step4: 'Test external access: http://103.42.248.224:3000/health'
      }
    }
  });
});

// Routes
const petRoutes = require('./api/pet/routes/pet.route');
app.use('/api/pets', petRoutes);

// User routes
const userRoutes = require('./api/user/routes/user.route');
app.use('/api/users', userRoutes);

// Start server
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n🚀 PackMates API Server Started!`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`\n📋 Access URLs:`);
  console.log(`  🏠 Local:      http://localhost:${PORT}`);
  console.log(`  🌐 Network:    http://0.0.0.0:${PORT}`);
  console.log(`  🔍 IP Info:    http://localhost:${PORT}/ip`);
  
  // Get local network IPs
  const os = require('os');
  const networkInterfaces = os.networkInterfaces();
  const localIPs = [];
  
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        localIPs.push(iface.address);
      }
    }
  }
  
  if (localIPs.length > 0) {
    console.log(`  📱 Mobile/Other devices on same network:`);
    localIPs.forEach(ip => {
      console.log(`     http://${ip}:${PORT}`);
    });
  }
  
  // Try to get external IP on startup
  try {
    const https = require('https');
    const externalIp = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.ipify.org',
        port: 443,
        path: '/',
        method: 'GET'
      };
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => resolve(data.trim()));
      });
      
      req.on('error', (err) => {
        resolve(null);
      });
      
      req.setTimeout(3000, () => {
        req.destroy();
        resolve(null);
      });
      
      req.end();
    });
    
    if (externalIp) {
      console.log(`  🌍 External:   http://${externalIp}:${PORT}`);
      console.log(`\n⚠️  For external access, configure router port forwarding:`);
      console.log(`   External Port: ${PORT} → Internal Port: ${PORT}`);
      console.log(`   Internal IP: ${localIPs[0] || 'Your local IP'}`);
    } else {
      console.log(`  🌍 External:   Check http://localhost:${PORT}/ip for external IP`);
    }
  } catch (error) {
    console.log(`  🌍 External:   Check http://localhost:${PORT}/ip for external IP`);
  }
  
  console.log(`\n✅ Server ready! Test endpoints:`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Pets:   http://localhost:${PORT}/api/pets/getAllPets`);
  console.log(`\n`);
});

// Add endpoint to get server IP address
app.get('/ip', async (req, res) => {
  const os = require('os');
  const https = require('https');
  const networkInterfaces = os.networkInterfaces();
  const addresses = [];
  
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          interface: interfaceName,
          address: iface.address,
          url: `http://${iface.address}:${PORT}`
        });
      }
    }
  }
  
  // Get external IP dynamically
  let externalIp = process.env.EXTERNAL_IP || null;
  
  if (!externalIp) {
    try {
      externalIp = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.ipify.org',
          port: 443,
          path: '/',
          method: 'GET'
        };
        
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => resolve(data.trim()));
        });
        
        req.on('error', (err) => {
          console.log('Could not fetch external IP:', err.message);
          resolve('Unable to fetch external IP');
        });
        
        req.setTimeout(5000, () => {
          req.destroy();
          resolve('Timeout fetching external IP');
        });
        
        req.end();
      });
    } catch (error) {
      externalIp = 'Unable to fetch external IP';
    }
  }
  
  res.json({
    port: PORT,
    localAddresses: addresses,
    externalAccess: externalIp && externalIp !== 'Unable to fetch external IP' ? `http://${externalIp}:${PORT}` : null,
    externalIp: externalIp,
    message: 'Use these URLs to access the server',
    instructions: {
      local: 'Use local addresses for same network devices',
      external: externalIp && externalIp !== 'Unable to fetch external IP' ? 
        `Use external IP for internet access: http://${externalIp}:${PORT}` : 
        'External IP not available - check internet connection or set EXTERNAL_IP env variable',
      setup: 'Configure router port forwarding: External Port 3000 -> Internal Port 3000'
    }
  });
});