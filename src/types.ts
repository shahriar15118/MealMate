export interface Member {
  id: string;
  name: string;
  phone: string;
  joinDate: string; // YYYY-MM-DD
  active: boolean;
  uid?: string;
  email?: string;
}

export interface Meal {
  id: string;
  memberId: string;
  memberName: string;
  date: string; // YYYY-MM-DD
  type: 'lunch' | 'dinner';
  status: 'active' | 'cancelled';
  cancelledAt: string | null; // ISO string or null
  createdAt: string; // ISO string
  late_cancel?: boolean;
}

export interface Payment {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  note: string;
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO string
  status?: 'pending' | 'confirmed' | 'rejected';
  proofUrl?: string;
  receivedById?: string; // The roommate id who collected the money
  receivedByName?: string; // The roommate name who collected the money (e.g. Akash)
  verifiedAt?: string;
  verifiedBy?: string;
}

export interface SettingsConfig {
  mealCost: number;
  lunchCancelDeadline: string; // HH:MM
  dinnerCancelDeadline: string; // HH:MM
}

export enum Tab {
  Dashboard = 'dashboard',
  Calendar = 'calendar',
  Members = 'members',
  Meals = 'meals',
  Settings = 'settings',
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}
