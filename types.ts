
export type Role = 'farmer' | 'buyer' | 'admin' | 'driver';

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  password?: string;
  role: Role;
  location?: Location;
  rating?: number;
  deliveryDistance?: number; // In km
  thresholdQuantity?: number;
  currentQuantity?: number;
  favorites?: string[]; // IDs of farmers
  materialDebt?: number;
  trustScore?: number;
  walletBalance?: number;
}

export interface Resource {
  id: string;
  type: 'seed' | 'fertilizer' | 'land' | 'tool';
  name: string;
  cost: number;
  unit: string;
  stock: number;
}

export interface FarmerResource {
  id: string;
  farmerId: string;
  resourceId: string;
  resourceName?: string; // Joined from resources table
  quantity: number;
  totalCost: number;
  status: 'requested' | 'assigned' | 'picked_up' | 'delivered' | 'consumed';
  deliveryRequested?: boolean;
  date: string;
  driverId?: string;
}

export interface GrowthLog {
  id: string;
  farmerId: string;
  description: string;
  imageUrl: string;
  stage: string;
  date: string;
}

export interface Product {
  id: string;
  farmerId: string;
  name: string;
  price: number;
  unit: string;
  category: string;
  description: string;
  imageUrl?: string;
  stock: number;
}

export interface Delivery {
  id: string;
  orderId: string;
  driverId: string;
  pickupLocation: string;
  dropoffLocation: string;
  status: 'assigned' | 'picked_up' | 'delivered';
  proofOfDelivery?: string; // Image URL or OTP
  timestamp: string;
}

export interface Order {
  id: string;
  productId: string;
  productName: string;
  farmerId: string;
  farmName: string;
  buyerId: string;
  buyerName: string;
  buyerLocation?: string;
  quantity: number;
  totalPrice: number;
  status: 'pending' | 'confirmed' | 'harvested' | 'picked_up' | 'delivered' | 'cancelled';
  date: string;
  driverRequested?: boolean;
  rating?: number;
  debtPaid?: number;
  paymentSplit?: {
    farmer: number;
    admin: number;
    driver: number;
    platform: number;
  };
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
}
