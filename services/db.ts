import { User, Product, Order, ChatMessage, Resource, FarmerResource, GrowthLog, Delivery } from '../types';

/**
 * Real API client for the frontend connecting to MySQL backend.
 */
class Collection<T extends { id: string }> {
  private endpoint: string;

  constructor(collectionName: string) {
    this.endpoint = `/api/${collectionName}`;
  }

  async find(query?: Partial<T>): Promise<T[]> {
    const cacheKey = `${this.endpoint}_${JSON.stringify(query || {})}`;
    const cachedData = localStorage.getItem(cacheKey);
    
    // Return cached data immediately if available
    if (cachedData) {
      try {
        return JSON.parse(cachedData);
      } catch (e) {
        console.error("Failed to parse cached data", e);
      }
    }

    try {
      const url = new URL(this.endpoint, window.location.origin);
      if (query) {
        Object.entries(query).forEach(([key, value]) => {
          if (value !== undefined) url.searchParams.append(key, String(value));
        });
      }
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error(`Failed to fetch ${this.endpoint}`);
      const data = await response.json();
      
      // Update cache
      localStorage.setItem(cacheKey, JSON.stringify(data));
      
      return data;
    } catch (e) {
      console.error(`Error in find ${this.endpoint}:`, e);
      return [];
    }
  }

  async insertOne(item: T): Promise<T> {
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
      if (!response.ok) throw new Error(`Failed to insert into ${this.endpoint}`);
      const data = await response.json();
      
      // Invalidate cache for this collection
      this.invalidateCache();
      
      return data;
    } catch (e) {
      console.error(`Error in insertOne ${this.endpoint}:`, e);
      throw e;
    }
  }

  async updateOne(id: string, updates: Partial<T>): Promise<void> {
    try {
      const response = await fetch(`${this.endpoint}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error(`Failed to update ${this.endpoint}/${id}`);
      
      // Invalidate cache for this collection
      this.invalidateCache();
    } catch (e) {
      console.error(`Error in updateOne ${this.endpoint}:`, e);
      throw e;
    }
  }

  async deleteOne(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.endpoint}/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error(`Failed to delete ${this.endpoint}/${id}`);
      
      // Invalidate cache for this collection
      this.invalidateCache();
    } catch (e) {
      console.error(`Error in deleteOne ${this.endpoint}:`, e);
      throw e;
    }
  }

  private invalidateCache() {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(this.endpoint)) {
        localStorage.removeItem(key);
      }
    });
  }

  async findOne(query: Partial<T>): Promise<T | null> {
    const hasQuery = Object.values(query).some(v => v !== undefined);
    if (!hasQuery) return null;
    const results = await this.find(query);
    return results.length > 0 ? results[0] : null;
  }
}

class AgroDatabase {
  users = new Collection<User>('users');
  products = new Collection<Product>('products');
  orders = new Collection<Order>('orders');
  messages = new Collection<ChatMessage>('messages');
  resources = new Collection<Resource>('resources');
  farmerResources = new Collection<FarmerResource>('farmer_resources');
  growthLogs = new Collection<GrowthLog>('growth_logs');
  deliveries = new Collection<Delivery>('deliveries');

  async login(email: string, password: string): Promise<User | null> {
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      console.error("Login failed:", e);
      return null;
    }
  }
}

export const db = new AgroDatabase();
