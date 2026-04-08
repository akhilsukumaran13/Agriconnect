import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'agriconnect',
  port: Number(process.env.MYSQL_PORT) || 3306,
  ssl: (process.env.MYSQL_SSL === 'true' || process.env.MYSQL_HOST?.includes('tidbcloud')) ? {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: true
  } : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

export async function initDB() {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password VARCHAR(255) NOT NULL,
        role ENUM('farmer', 'buyer', 'admin') NOT NULL,
        location JSON,
        favorites JSON,
        rating FLOAT DEFAULT 0,
        deliveryDistance INT DEFAULT 0,
        thresholdQuantity INT DEFAULT 0,
        currentQuantity INT DEFAULT 0,
        materialDebt FLOAT DEFAULT 0,
        trustScore FLOAT DEFAULT 0,
        walletBalance FLOAT DEFAULT 0
      )
    `);

    // Check if columns exist and add them if not (for existing tables)
    try {
      await connection.query("ALTER TABLE users ADD COLUMN materialDebt FLOAT DEFAULT 0");
    } catch (e) { /* ignore if exists */ }
    try {
      await connection.query("ALTER TABLE users ADD COLUMN trustScore FLOAT DEFAULT 0");
    } catch (e) { /* ignore if exists */ }
    try {
      await connection.query("ALTER TABLE users ADD COLUMN walletBalance FLOAT DEFAULT 0");
    } catch (e) { /* ignore if exists */ }
    try {
      await connection.query("ALTER TABLE users MODIFY COLUMN role ENUM('farmer', 'buyer', 'admin', 'driver') NOT NULL");
    } catch (e) { /* ignore if exists */ }

    // Seed Admin User
    const [rows] = await connection.query("SELECT * FROM users WHERE email = 'akhil@gmail.com'");
    if ((rows as any[]).length === 0) {
      const hashedPassword = await bcrypt.hash('Akhil@123', 10);
      await connection.query(
        "INSERT INTO users (id, name, email, phone, password, role) VALUES (?, ?, ?, ?, ?, ?)",
        ['admin-1', 'Super Admin', 'akhil@gmail.com', '0000000000', hashedPassword, 'admin']
      );
      console.log('Admin user seeded');
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS resources (
        id VARCHAR(255) PRIMARY KEY,
        type ENUM('seed', 'fertilizer', 'land', 'tool') NOT NULL,
        name VARCHAR(255) NOT NULL,
        cost FLOAT NOT NULL,
        unit VARCHAR(50) NOT NULL,
        stock INT DEFAULT 0
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS farmer_resources (
        id VARCHAR(255) PRIMARY KEY,
        farmerId VARCHAR(255) NOT NULL,
        resourceId VARCHAR(255) NOT NULL,
        quantity FLOAT NOT NULL,
        totalCost FLOAT NOT NULL,
        status ENUM('requested', 'assigned', 'picked_up', 'delivered', 'consumed') DEFAULT 'assigned',
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        driverId VARCHAR(255),
        FOREIGN KEY (farmerId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (resourceId) REFERENCES resources(id) ON DELETE CASCADE,
        FOREIGN KEY (driverId) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    try {
      await connection.query("ALTER TABLE farmer_resources MODIFY COLUMN status ENUM('requested', 'assigned', 'picked_up', 'delivered', 'consumed') DEFAULT 'assigned'");
    } catch (e) { console.error("Failed to alter status enum:", e); }
    try {
      await connection.query("ALTER TABLE farmer_resources ADD COLUMN deliveryRequested BOOLEAN DEFAULT FALSE");
    } catch (e) { /* ignore */ }
    try {
      await connection.query("ALTER TABLE farmer_resources ADD COLUMN driverId VARCHAR(255)");
    } catch (e) { /* ignore */ }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS growth_logs (
        id VARCHAR(255) PRIMARY KEY,
        farmerId VARCHAR(255) NOT NULL,
        description TEXT,
        imageUrl LONGTEXT,
        stage VARCHAR(100),
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (farmerId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(255) PRIMARY KEY,
        farmerId VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        price FLOAT NOT NULL,
        category VARCHAR(100),
        unit VARCHAR(20),
        stock INT,
        description TEXT,
        imageUrl LONGTEXT,
        FOREIGN KEY (farmerId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(255) PRIMARY KEY,
        productId VARCHAR(255),
        productName VARCHAR(255),
        farmerId VARCHAR(255) NOT NULL,
        farmName VARCHAR(255),
        buyerId VARCHAR(255),
        buyerName VARCHAR(255),
        buyerLocation VARCHAR(255),
        quantity INT,
        totalPrice FLOAT,
        status ENUM('pending', 'confirmed', 'harvested', 'picked_up', 'delivered', 'cancelled') DEFAULT 'pending',
        date DATETIME DEFAULT CURRENT_TIMESTAMP,
        paymentSplit JSON,
        driverRequested BOOLEAN DEFAULT FALSE,
        rating FLOAT DEFAULT 0,
        debtPaid FLOAT DEFAULT 0,
        FOREIGN KEY (farmerId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    try {
      await connection.query("ALTER TABLE orders MODIFY COLUMN status ENUM('pending', 'confirmed', 'harvested', 'picked_up', 'delivered', 'cancelled') DEFAULT 'pending'");
    } catch (e) { /* ignore */ }
    try {
      await connection.query("ALTER TABLE orders ADD COLUMN paymentSplit JSON");
    } catch (e) { /* ignore */ }
    // Drop all foreign keys on orders table to allow reverse logistics and warehouse returns
    try {
      const [fks]: any = await connection.query(`
        SELECT CONSTRAINT_NAME 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_NAME = 'orders' 
        AND TABLE_SCHEMA = DATABASE() 
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `);
      for (const fk of fks) {
        try {
          await connection.query(`ALTER TABLE orders DROP FOREIGN KEY ${fk.CONSTRAINT_NAME}`);
        } catch (e) { console.log(`Failed to drop FK ${fk.CONSTRAINT_NAME}:`, e.message); }
      }
    } catch (e) { console.log("Failed to query FKs:", e.message); }

    try {
      await connection.query("ALTER TABLE orders MODIFY COLUMN productId VARCHAR(255) NULL");
    } catch (e) { /* ignore */ }
    try {
      await connection.query("ALTER TABLE orders MODIFY COLUMN buyerId VARCHAR(255) NULL");
    } catch (e) { /* ignore */ }
    try {
      await connection.query("ALTER TABLE orders ADD COLUMN driverRequested BOOLEAN DEFAULT FALSE");
    } catch (e) { /* ignore */ }
    try {
      await connection.query("ALTER TABLE orders ADD COLUMN rating FLOAT DEFAULT 0");
    } catch (e) { /* ignore */ }
    try {
      await connection.query("ALTER TABLE orders ADD COLUMN debtPaid FLOAT DEFAULT 0");
    } catch (e) { /* ignore */ }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id VARCHAR(255) PRIMARY KEY,
        orderId VARCHAR(255) NOT NULL,
        driverId VARCHAR(255) NOT NULL,
        pickupLocation VARCHAR(255),
        dropoffLocation VARCHAR(255),
        status ENUM('assigned', 'picked_up', 'delivered') DEFAULT 'assigned',
        proofOfDelivery LONGTEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY (driverId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id VARCHAR(255) PRIMARY KEY,
        senderId VARCHAR(255) NOT NULL,
        receiverId VARCHAR(255) NOT NULL,
        text TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiverId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    console.log('MySQL Database initialized');
  } catch (err) {
    console.error('Error initializing MySQL database:', err);
  } finally {
    if (connection) connection.release();
  }
}

export default pool;
