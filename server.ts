import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import pool, { initDB } from "./server/db";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // Global request logger
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });

  app.get("/test-server", (req, res) => res.send("Server is UP"));

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV || "development" });
  });
  
  // Users
  app.get("/api/users", async (req, res) => {
    try {
      const { email, role, id } = req.query;
      let query = "SELECT * FROM users WHERE 1=1";
      let params = [];
      
      if (id) {
        query += " AND id = ?";
        params.push(id);
      }
      if (email) {
        query += " AND email = ?";
        params.push(email);
      }
      if (role) {
        query += " AND role = ?";
        params.push(role);
      }
      
      const [rows] = await pool.query(query, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [req.params.id]);
      res.json(rows[0] || null);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const user = req.body;
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      await pool.query(
        "INSERT INTO users (id, name, email, phone, password, role, location, favorites, rating, deliveryDistance, thresholdQuantity, currentQuantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [user.id, user.name, user.email, user.phone, hashedPassword, user.role, JSON.stringify(user.location || null), JSON.stringify(user.favorites || []), user.rating, user.deliveryDistance, user.thresholdQuantity, user.currentQuantity]
      );
      
      // Return user without password
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (err) {
      console.error("Error in POST /api/users:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
      const user = (rows as any)[0];

      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (err) {
      console.error("Error in POST /api/login:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const updates = req.body;
      const keys = Object.keys(updates);
      const values = Object.values(updates).map(v => (typeof v === 'object' ? JSON.stringify(v) : v));
      
      if (keys.length === 0) return res.json({ success: true });

      const setClause = keys.map(key => `${key} = ?`).join(", ");
      await pool.query(`UPDATE users SET ${setClause} WHERE id = ?`, [...values, req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Products
  app.get("/api/products", async (req, res) => {
    try {
      const { farmerId, id } = req.query;
      let query = "SELECT * FROM products WHERE 1=1";
      let params = [];
      if (id) {
        query += " AND id = ?";
        params.push(id);
      }
      if (farmerId) {
        query += " AND farmerId = ?";
        params.push(farmerId);
      }
      const [rows] = await pool.query(query, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/products", async (req, res) => {
    try {
      const p = req.body;
      await pool.query(
        "INSERT INTO products (id, farmerId, name, price, category, unit, stock, description, imageUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [p.id, p.farmerId, p.name, p.price, p.category, p.unit, p.stock, p.description, p.imageUrl]
      );
      res.json(p);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/products/:id", async (req, res) => {
    try {
      const updates = req.body;
      const keys = Object.keys(updates);
      const values = Object.values(updates);
      if (keys.length === 0) return res.json({ success: true });
      const setClause = keys.map(key => `${key} = ?`).join(", ");
      await pool.query(`UPDATE products SET ${setClause} WHERE id = ?`, [...values, req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/products/:id", async (req, res) => {
    try {
      await pool.query("DELETE FROM products WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Orders
  app.get("/api/orders", async (req, res) => {
    try {
      const { buyerId, farmerId, id } = req.query;
      let query = "SELECT * FROM orders WHERE 1=1";
      let params = [];
      if (id) {
        query += " AND id = ?";
        params.push(id);
      }
      if (buyerId) {
        query += " AND buyerId = ?";
        params.push(buyerId);
      }
      if (farmerId) {
        query += " AND farmerId = ?";
        params.push(farmerId);
      }
      const [rows] = await pool.query(query, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const o = req.body;
      await pool.query(
        "INSERT INTO orders (id, productId, productName, farmerId, farmName, buyerId, buyerName, buyerLocation, quantity, totalPrice, status, driverRequested, paymentSplit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [o.id, o.productId, o.productName, o.farmerId, o.farmName, o.buyerId, o.buyerName, o.buyerLocation, o.quantity, o.totalPrice, o.status, o.driverRequested || false, JSON.stringify(o.paymentSplit || {})]
      );
      res.json(o);
    } catch (err) {
      console.error("Error creating order:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/orders/:id", async (req, res) => {
    try {
      const updates = req.body;

      // Debt reduction logic when order is delivered
      if (updates.status === 'delivered') {
        const [orderRows]: any = await pool.query("SELECT * FROM orders WHERE id = ?", [req.params.id]);
        if (orderRows.length > 0) {
          const order = orderRows[0];
          // Only deduct if status is changing TO delivered and order is not already delivered
          if (order.status !== 'delivered') {
            const [farmerRows]: any = await pool.query("SELECT * FROM users WHERE id = ?", [order.farmerId]);
            if (farmerRows.length > 0) {
              const farmer = farmerRows[0];
              if (farmer.materialDebt > 0) {
                // Deduct 10% of order value for debt repayment
                const debtDeduction = Math.min(farmer.materialDebt, Math.round(order.totalPrice * 0.1));
                if (debtDeduction > 0) {
                  await pool.query("UPDATE users SET materialDebt = materialDebt - ? WHERE id = ?", [debtDeduction, farmer.id]);
                  updates.debtPaid = debtDeduction;
                }
              }
              
              // Update wallet balance: add farmer's share (70%) minus what they paid for debt
              const farmerShare = Math.round(order.totalPrice * 0.7);
              const netGain = farmerShare - (updates.debtPaid || 0);
              await pool.query("UPDATE users SET walletBalance = walletBalance + ? WHERE id = ?", [netGain, farmer.id]);
            }
          }
        }
      }

      const keys = Object.keys(updates);
      const values = Object.values(updates);
      if (keys.length === 0) return res.json({ success: true });
      const setClause = keys.map(key => `${key} = ?`).join(", ");
      await pool.query(`UPDATE orders SET ${setClause} WHERE id = ?`, [...values, req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Messages
  app.get("/api/messages", async (req, res) => {
    try {
      const { senderId, receiverId } = req.query;
      let query = "SELECT * FROM messages";
      let params = [];
      if (senderId && receiverId) {
        query += " WHERE (senderId = ? AND receiverId = ?) OR (senderId = ? AND receiverId = ?)";
        params.push(senderId, receiverId, receiverId, senderId);
      }
      query += " ORDER BY timestamp ASC";
      const [rows] = await pool.query(query, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const m = req.body;
      
      // Ensure required fields are present
      if (!m.senderId || !m.receiverId || !m.text) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Convert ISO timestamp to MySQL DATETIME format (YYYY-MM-DD HH:MM:SS)
      const timestamp = m.timestamp 
        ? new Date(m.timestamp).toISOString().slice(0, 19).replace('T', ' ')
        : new Date().toISOString().slice(0, 19).replace('T', ' ');

      await pool.query(
        "INSERT INTO messages (id, senderId, receiverId, text, timestamp) VALUES (?, ?, ?, ?, ?)",
        [m.id, m.senderId, m.receiverId, m.text, timestamp]
      );
      res.json(m);
    } catch (err) {
      console.error("Error inserting message:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Resources (Admin)
  app.get("/api/resources", async (req, res) => {
    try {
      const { id } = req.query;
      let query = "SELECT * FROM resources WHERE 1=1";
      let params = [];
      if (id) {
        query += " AND id = ?";
        params.push(id);
      }
      const [rows] = await pool.query(query, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/resources", async (req, res) => {
    try {
      const r = req.body;
      await pool.query(
        "INSERT INTO resources (id, type, name, cost, unit, stock) VALUES (?, ?, ?, ?, ?, ?)",
        [r.id, r.type, r.name, r.cost, r.unit, r.stock]
      );
      res.json(r);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Farmer Resources (Assignments)
  app.get("/api/farmer_resources", async (req, res) => {
    try {
      const { farmerId, driverId, id } = req.query;
      let query = `
        SELECT fr.*, r.name as resourceName, r.unit 
        FROM farmer_resources fr 
        JOIN resources r ON fr.resourceId = r.id
        WHERE 1=1
      `;
      let params = [];
      if (id) {
        query += " AND fr.id = ?";
        params.push(id);
      }
      if (farmerId) {
        query += " AND fr.farmerId = ?";
        params.push(farmerId);
      }
      if (driverId) {
        query += " AND fr.driverId = ?";
        params.push(driverId);
      }
      query += " ORDER BY fr.date DESC";
      const [rows] = await pool.query(query, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/farmer_resources", async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const fr = req.body;

      // Check stock first
      const [resourceRows]: any = await connection.query("SELECT stock, name FROM resources WHERE id = ?", [fr.resourceId]);
      if (resourceRows.length === 0) {
        throw new Error("Resource not found");
      }
      const resource = resourceRows[0];
      if (resource.stock < fr.quantity) {
        throw new Error(`Insufficient stock for ${resource.name}`);
      }

      // Insert assignment
      await connection.query(
        "INSERT INTO farmer_resources (id, farmerId, resourceId, quantity, totalCost, status, driverId) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [fr.id, fr.farmerId, fr.resourceId, fr.quantity, fr.totalCost, fr.status, fr.driverId || null]
      );
      
      // Decrement stock
      await connection.query(
        "UPDATE resources SET stock = stock - ? WHERE id = ?",
        [fr.quantity, fr.resourceId]
      );

      // Update user debt only if assigned directly
      if (fr.status === 'assigned') {
        await connection.query(
          "UPDATE users SET materialDebt = materialDebt + ? WHERE id = ?",
          [fr.totalCost, fr.farmerId]
        );
      }

      await connection.commit();
      res.json(fr);
    } catch (err) {
      await connection.rollback();
      console.error("Error inserting farmer_resource:", err);
      res.status(500).json({ error: err.message });
    } finally {
      connection.release();
    }
  });

  app.delete("/api/farmer_resources/:id", async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Get the resource info before deleting to restore stock
      const [frRows]: any = await connection.query("SELECT resourceId, quantity, status FROM farmer_resources WHERE id = ?", [req.params.id]);
      if (frRows.length > 0) {
        const fr = frRows[0];
        // Restore stock if it was requested or assigned (not consumed)
        if (fr.status !== 'consumed') {
          await connection.query(
            "UPDATE resources SET stock = stock + ? WHERE id = ?",
            [fr.quantity, fr.resourceId]
          );
        }
      }

      await connection.query("DELETE FROM farmer_resources WHERE id = ?", [req.params.id]);
      
      await connection.commit();
      res.json({ success: true });
    } catch (err) {
      await connection.rollback();
      res.status(500).json({ error: err.message });
    } finally {
      connection.release();
    }
  });

  app.patch("/api/farmer_resources/:id", async (req, res) => {
    try {
      const updates = req.body;
      const keys = Object.keys(updates);
      const values = Object.values(updates);
      if (keys.length === 0) return res.json({ success: true });
      const setClause = keys.map(key => `${key} = ?`).join(", ");
      await pool.query(`UPDATE farmer_resources SET ${setClause} WHERE id = ?`, [...values, req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Growth Logs
  app.get("/api/growth_logs", async (req, res) => {
    try {
      const { farmerId, id } = req.query;
      let query = "SELECT * FROM growth_logs WHERE 1=1";
      let params = [];
      if (id) {
        query += " AND id = ?";
        params.push(id);
      }
      if (farmerId) {
        query += " AND farmerId = ?";
        params.push(farmerId);
      }
      query += " ORDER BY date DESC";
      const [rows] = await pool.query(query, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/growth_logs", async (req, res) => {
    try {
      const gl = req.body;
      await pool.query(
        "INSERT INTO growth_logs (id, farmerId, description, imageUrl, stage) VALUES (?, ?, ?, ?, ?)",
        [gl.id, gl.farmerId, gl.description, gl.imageUrl, gl.stage]
      );
      
      // Update trust score (simple logic: +0.1 per log)
      await pool.query(
        "UPDATE users SET trustScore = trustScore + 0.1 WHERE id = ?",
        [gl.farmerId]
      );

      res.json(gl);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Deliveries
  app.get("/api/deliveries", async (req, res) => {
    try {
      const { driverId, status, id } = req.query;
      let query = "SELECT * FROM deliveries WHERE 1=1";
      let params = [];
      if (id) {
        query += " AND id = ?";
        params.push(id);
      }
      if (driverId) {
        query += " AND driverId = ?";
        params.push(driverId);
      }
      if (status) {
        query += " AND status = ?";
        params.push(status);
      }
      const [rows] = await pool.query(query, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/deliveries", async (req, res) => {
    try {
      const d = req.body;
      await pool.query(
        "INSERT INTO deliveries (id, orderId, driverId, pickupLocation, dropoffLocation, status) VALUES (?, ?, ?, ?, ?, ?)",
        [d.id, d.orderId, d.driverId, d.pickupLocation, d.dropoffLocation, d.status]
      );
      res.json(d);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/deliveries/:id", async (req, res) => {
    try {
      const updates = req.body;
      const keys = Object.keys(updates);
      const values = Object.values(updates);
      if (keys.length === 0) return res.json({ success: true });
      const setClause = keys.map(key => `${key} = ?`).join(", ");
      await pool.query(`UPDATE deliveries SET ${setClause} WHERE id = ?`, [...values, req.params.id]);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Initialize DB (non-blocking)
  initDB().catch(err => console.error("DB Init failed:", err));

  const isProduction = process.env.NODE_ENV?.trim() === "production" || process.env.RENDER === "true";
  console.log(`Environment check: NODE_ENV=${process.env.NODE_ENV}, isProduction=${isProduction}`);

  // Vite middleware for development
  if (!isProduction) {
    console.log("Starting Vite development server...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite middleware attached.");
  } else {
    console.log("Serving static files from dist...");
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  console.log(`Attempting to bind to port ${PORT}...`);
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Try health check at: /api/health`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
