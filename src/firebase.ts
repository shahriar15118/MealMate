import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  query,
  onSnapshot,
  writeBatch,
  addDoc,
  updateDoc,
  setDoc,
  getDocs,
  deleteDoc
} from 'firebase/firestore';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';
import { Member, Meal, Payment, SettingsConfig } from './types';

// === FIREBASE INIT ===
const app = initializeApp(firebaseConfig);
export const db = (firebaseConfig as any).firestoreDatabaseId 
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId) 
  : getFirestore(app);
export const auth = getAuth();
export const storage = getStorage(app);

// Test Connection on startup as outlined in rules
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase connection established successfully.");
  } catch (error) {
    if (error instanceof Error && error.message.includes('offline')) {
      console.warn("Firebase connection status: The client appears to be offline or config-restricted. Diagnostic info: " + error.message);
    } else {
      console.log("Firebase connection test compete: " + (error instanceof Error ? error.message : String(error)));
    }
  }
}
testConnection();

// === STATUTORY ERROR HANDLER ===
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error Detailed Context: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// === DUAL MODE LOCAL STORAGE FALLBACK ===
export function isLocalMode(): boolean {
  return localStorage.getItem('mealmate_local_mode') === 'true';
}

export function setLocalMode(enabled: boolean) {
  if (enabled) {
    localStorage.setItem('mealmate_local_mode', 'true');
  } else {
    localStorage.removeItem('mealmate_local_mode');
    localStorage.removeItem(LOCAL_STORAGE_KEYS.SETTINGS);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.MEMBERS);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.MEALS);
    localStorage.removeItem(LOCAL_STORAGE_KEYS.PAYMENTS);
  }
}

const LOCAL_STORAGE_KEYS = {
  SETTINGS: 'mealmate_settings_custom',
  MEMBERS: 'mealmate_members_custom',
  MEALS: 'mealmate_meals_custom',
  PAYMENTS: 'mealmate_payments_custom'
};

function getLocalSettings(): SettingsConfig {
  const data = localStorage.getItem(LOCAL_STORAGE_KEYS.SETTINGS);
  if (data) return JSON.parse(data);
  const defaults: SettingsConfig = {
    mealCost: 65,
    lunchCancelDeadline: '09:00',
    dinnerCancelDeadline: '17:00'
  };
  localStorage.setItem(LOCAL_STORAGE_KEYS.SETTINGS, JSON.stringify(defaults));
  return defaults;
}

function getLocalMembers(): Member[] {
  const data = localStorage.getItem(LOCAL_STORAGE_KEYS.MEMBERS);
  if (data) return JSON.parse(data);
  const defaults: Member[] = [
    { id: 'm1', name: 'Shahriar Rahama', phone: '01711223344', joinDate: '2026-06-01', active: true, email: 'shahriarrahama@gmail.com', uid: 'u1' },
    { id: 'm2', name: 'Taskin Ahmed', phone: '01811223344', joinDate: '2026-06-02', active: true, email: 'taskin@gmail.com', uid: 'u2' },
    { id: 'm3', name: 'Rafsan Habib', phone: '01911223344', joinDate: '2026-06-03', active: true, email: 'rafsan@gmail.com', uid: 'u3' }
  ];
  localStorage.setItem(LOCAL_STORAGE_KEYS.MEMBERS, JSON.stringify(defaults));
  return defaults;
}

function getLocalMeals(): Meal[] {
  const data = localStorage.getItem(LOCAL_STORAGE_KEYS.MEALS);
  if (data) return JSON.parse(data);
  const todayStr = new Date().toISOString().split('T')[0];
  const defaults: Meal[] = [
    { id: 'me1', memberId: 'm1', memberName: 'Shahriar Rahama', date: todayStr, type: 'lunch', status: 'active', createdAt: new Date().toISOString(), cancelledAt: null },
    { id: 'me2', memberId: 'm1', memberName: 'Shahriar Rahama', date: todayStr, type: 'dinner', status: 'active', createdAt: new Date().toISOString(), cancelledAt: null },
    { id: 'me3', memberId: 'm2', memberName: 'Taskin Ahmed', date: todayStr, type: 'lunch', status: 'active', createdAt: new Date().toISOString(), cancelledAt: null },
    { id: 'me4', memberId: 'm2', memberName: 'Taskin Ahmed', date: todayStr, type: 'dinner', status: 'cancelled', createdAt: new Date().toISOString(), cancelledAt: new Date().toISOString() },
    { id: 'me5', memberId: 'm3', memberName: 'Rafsan Habib', date: todayStr, type: 'lunch', status: 'active', createdAt: new Date().toISOString(), cancelledAt: null },
    { id: 'me6', memberId: 'm3', memberName: 'Rafsan Habib', date: todayStr, type: 'dinner', status: 'active', createdAt: new Date().toISOString(), cancelledAt: null }
  ];
  localStorage.setItem(LOCAL_STORAGE_KEYS.MEALS, JSON.stringify(defaults));
  return defaults;
}

function getLocalPayments(): Payment[] {
  const data = localStorage.getItem(LOCAL_STORAGE_KEYS.PAYMENTS);
  if (data) return JSON.parse(data);
  const defaults: Payment[] = [
    { id: 'p1', memberId: 'm1', memberName: 'Shahriar Rahama', amount: 3500, note: 'Initial Mess Deposit', date: '2026-06-01', createdAt: new Date().toISOString(), status: 'confirmed' },
    { id: 'p2', memberId: 'm2', memberName: 'Taskin Ahmed', amount: 3000, note: 'Cash payment to Manager', date: '2026-06-02', createdAt: new Date().toISOString(), status: 'confirmed' }
  ];
  localStorage.setItem(LOCAL_STORAGE_KEYS.PAYMENTS, JSON.stringify(defaults));
  return defaults;
}

const settingsCallbacks = new Set<(config: SettingsConfig) => void>();
const membersCallbacks = new Set<(members: Member[]) => void>();
const mealsCallbacks = new Set<(meals: Meal[]) => void>();
const paymentsCallbacks = new Set<(payments: Payment[]) => void>();

function notifySettings() {
  const current = getLocalSettings();
  settingsCallbacks.forEach(cb => cb(current));
}
function notifyMembers() {
  const current = getLocalMembers().sort((a,b) => a.name.localeCompare(b.name));
  membersCallbacks.forEach(cb => cb(current));
}
function notifyMeals() {
  const current = getLocalMeals();
  mealsCallbacks.forEach(cb => cb(current));
}
function notifyPayments() {
  const current = getLocalPayments().sort((a,b) => b.date.localeCompare(a.date));
  paymentsCallbacks.forEach(cb => cb(current));
}

// === FIRESTORE CRUD UTILITIES ===

/**
 * Sync active settings/config
 */
export function syncSettings(onUpdate: (config: SettingsConfig) => void, onError: (err: Error) => void) {
  if (isLocalMode()) {
    settingsCallbacks.add(onUpdate);
    setTimeout(() => {
      onUpdate(getLocalSettings());
    }, 50);
    return () => {
      settingsCallbacks.delete(onUpdate);
    };
  }

  const docRef = doc(db, 'settings', 'config');
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate(snapshot.data() as SettingsConfig);
    } else {
      // Default fallback settings
      const defaultSettings: SettingsConfig = {
        mealCost: 65,
        lunchCancelDeadline: '09:00',
        dinnerCancelDeadline: '17:00'
      };
      // Auto-save default if not existing
      setDoc(docRef, defaultSettings).catch(err => {
        console.error("Failed to seed settings: ", err);
      });
      onUpdate(defaultSettings);
    }
  }, (error) => {
    try {
      handleFirestoreError(error, OperationType.GET, 'settings/config');
    } catch (err) {
      onError(err as Error);
    }
  });
}

/**
 * Update system settings in Firestore
 */
export async function updateSettingsInDb(config: SettingsConfig): Promise<void> {
  const path = 'settings/config';
  if (isLocalMode()) {
    localStorage.setItem(LOCAL_STORAGE_KEYS.SETTINGS, JSON.stringify(config));
    notifySettings();
    return;
  }
  try {
    const docRef = doc(db, 'settings', 'config');
    await setDoc(docRef, config);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Add a new member
 */
export async function addMemberInDb(name: string, phone: string, joinDate: string): Promise<string> {
  const path = 'members';
  if (isLocalMode()) {
    const list = getLocalMembers();
    const id = 'm_' + Date.now().toString() + Math.random().toString().substring(2,6);
    list.push({
      id,
      name,
      phone,
      joinDate,
      active: true,
      email: name.toLowerCase().replace(/\s+/g, '') + '@gmail.com',
      uid: 'u_' + id
    });
    localStorage.setItem(LOCAL_STORAGE_KEYS.MEMBERS, JSON.stringify(list));
    notifyMembers();
    return id;
  }
  try {
    const docRef = await addDoc(collection(db, path), {
      name,
      phone,
      joinDate,
      active: true
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Toggle member active status (soft delete)
 */
export async function toggleMemberActiveInDb(memberId: string, active: boolean): Promise<void> {
  const path = `members/${memberId}`;
  if (isLocalMode()) {
    const list = getLocalMembers();
    const item = list.find(m => m.id === memberId);
    if (item) {
      item.active = active;
      localStorage.setItem(LOCAL_STORAGE_KEYS.MEMBERS, JSON.stringify(list));
      notifyMembers();
    }
    return;
  }
  try {
    const docRef = doc(db, 'members', memberId);
    await updateDoc(docRef, { active });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Edit member details
 */
export async function updateMemberInDb(memberId: string, name: string, phone: string): Promise<void> {
  const path = `members/${memberId}`;
  if (isLocalMode()) {
    const list = getLocalMembers();
    const item = list.find(m => m.id === memberId);
    if (item) {
      item.name = name;
      item.phone = phone;
      localStorage.setItem(LOCAL_STORAGE_KEYS.MEMBERS, JSON.stringify(list));
      notifyMembers();
    }
    return;
  }
  try {
    const docRef = doc(db, 'members', memberId);
    await updateDoc(docRef, { name, phone });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Sync members list
 */
export function syncMembers(onUpdate: (members: Member[]) => void, onError: (err: Error) => void) {
  if (isLocalMode()) {
    membersCallbacks.add(onUpdate);
    setTimeout(() => {
      onUpdate(getLocalMembers().sort((a,b) => a.name.localeCompare(b.name)));
    }, 50);
    return () => {
      membersCallbacks.delete(onUpdate);
    };
  }

  const path = 'members';
  const q = query(collection(db, path));
  
  return onSnapshot(q, (snapshot) => {
    const list: Member[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      list.push({
        id: doc.id,
        name: data.name || '',
        phone: data.phone || '',
        joinDate: data.joinDate || '',
        active: typeof data.active === 'boolean' ? data.active : true,
        uid: data.uid || '',
        email: data.email || ''
      });
    });
    // Sort alphabetically by name
    list.sort((a, b) => a.name.localeCompare(b.name));
    onUpdate(list);
  }, (error) => {
    try {
      handleFirestoreError(error, OperationType.LIST, path);
    } catch (err) {
      onError(err as Error);
    }
  });
}

/**
 * Create a single meal record
 */
export async function addMealInDb(meal: Omit<Meal, 'id'>): Promise<string> {
  const path = 'meals';
  if (isLocalMode()) {
    const list = getLocalMeals();
    const id = 'me_' + Date.now().toString() + Math.random().toString().substring(2,6);
    list.push({
      id,
      ...meal,
      createdAt: new Date().toISOString()
    });
    localStorage.setItem(LOCAL_STORAGE_KEYS.MEALS, JSON.stringify(list));
    notifyMeals();
    return id;
  }
  try {
    const docRef = await addDoc(collection(db, path), {
      ...meal,
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Update/Delete/Cancel a specific meal status
 */
export async function cancelMealInDb(mealId: string, lateCancel: boolean): Promise<void> {
  const path = `meals/${mealId}`;
  if (isLocalMode()) {
    const list = getLocalMeals();
    const item = list.find(m => m.id === mealId);
    if (item) {
      item.status = 'cancelled';
      item.cancelledAt = new Date().toISOString();
      item.late_cancel = lateCancel;
      localStorage.setItem(LOCAL_STORAGE_KEYS.MEALS, JSON.stringify(list));
      notifyMeals();
    }
    return;
  }
  try {
    const docRef = doc(db, 'meals', mealId);
    await updateDoc(docRef, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      late_cancel: lateCancel
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Reactivate a previously cancelled meal
 */
export async function reactivateMealInDb(mealId: string): Promise<void> {
  const path = `meals/${mealId}`;
  if (isLocalMode()) {
    const list = getLocalMeals();
    const item = list.find(m => m.id === mealId);
    if (item) {
      item.status = 'active';
      item.cancelledAt = null;
      item.late_cancel = false;
      localStorage.setItem(LOCAL_STORAGE_KEYS.MEALS, JSON.stringify(list));
      notifyMeals();
    }
    return;
  }
  try {
    const docRef = doc(db, 'meals', mealId);
    await updateDoc(docRef, {
      status: 'active',
      cancelledAt: null,
      late_cancel: false
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Set double-state or toggle meals (called from Calendar or interactive UI)
 */
export async function upsertMealInDb(memberId: string, memberName: string, date: string, type: 'lunch' | 'dinner', status: 'active' | 'cancelled', lateCancel: boolean = false): Promise<void> {
  const path = 'meals';
  if (isLocalMode()) {
    const list = getLocalMeals();
    const item = list.find(m => m.memberId === memberId && m.date === date && m.type === type);
    if (item) {
      item.status = status;
      item.cancelledAt = status === 'cancelled' ? new Date().toISOString() : null;
      item.late_cancel = status === 'cancelled' ? lateCancel : false;
    } else {
      list.push({
        id: 'me_' + Date.now().toString() + Math.random().toString().substring(2,6),
        memberId,
        memberName,
        date,
        type,
        status,
        createdAt: new Date().toISOString(),
        cancelledAt: status === 'cancelled' ? new Date().toISOString() : null,
        late_cancel: status === 'cancelled' ? lateCancel : false
      });
    }
    localStorage.setItem(LOCAL_STORAGE_KEYS.MEALS, JSON.stringify(list));
    notifyMeals();
    return;
  }
  try {
    // Check if meal already exists
    const q = query(
      collection(db, path),
      // We will search by filtering after sync to keep it simple, or execute a fast getDocs
    );
    const snap = await getDocs(q);
    let existingMealId: string | null = null;
    snap.forEach((doc) => {
      const d = doc.data();
      if (d.memberId === memberId && d.date === date && d.type === type) {
        existingMealId = doc.id;
      }
    });

    if (existingMealId) {
      const docRef = doc(db, 'meals', existingMealId);
      await updateDoc(docRef, {
        status: status,
        cancelledAt: status === 'cancelled' ? new Date().toISOString() : null,
        late_cancel: status === 'cancelled' ? lateCancel : false
      });
    } else {
      await addDoc(collection(db, 'meals'), {
        memberId,
        memberName,
        date,
        type,
        status,
        createdAt: new Date().toISOString(),
        cancelledAt: status === 'cancelled' ? new Date().toISOString() : null,
        late_cancel: status === 'cancelled' ? lateCancel : false
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Sync meals list
 */
export function syncMeals(onUpdate: (meals: Meal[]) => void, onError: (err: Error) => void) {
  if (isLocalMode()) {
    mealsCallbacks.add(onUpdate);
    setTimeout(() => {
      onUpdate(getLocalMeals());
    }, 50);
    return () => {
      mealsCallbacks.delete(onUpdate);
    };
  }

  const path = 'meals';
  const q = query(collection(db, path));
  
  return onSnapshot(q, (snapshot) => {
    const list: Meal[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      list.push({
        id: doc.id,
        memberId: data.memberId || '',
        memberName: data.memberName || '',
        date: data.date || '',
        type: data.type || 'lunch',
        status: data.status || 'active',
        cancelledAt: data.cancelledAt || null,
        createdAt: data.createdAt || '',
        late_cancel: !!data.late_cancel
      });
    });
    onUpdate(list);
  }, (error) => {
    try {
      handleFirestoreError(error, OperationType.LIST, path);
    } catch (err) {
      onError(err as Error);
    }
  });
}

/**
 * Upload a receipt payment image file to Firebase Storage
 */
export async function uploadPaymentReceipt(file: File): Promise<string> {
  const path = `payment_receipts/${Date.now()}_${file.name}`;
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  } catch (error) {
    console.error("Firebase Storage Upload Error:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to upload image to Firebase Storage");
  }
}

/**
 * Record a payment
 */
export async function addPaymentInDb(payment: Omit<Payment, 'id' | 'createdAt'>): Promise<string> {
  const path = 'payments';
  if (isLocalMode()) {
    const list = getLocalPayments();
    const id = 'p_' + Date.now().toString() + Math.random().toString().substring(2,6);
    list.push({
      id,
      ...payment,
      status: payment.status || 'pending',
      createdAt: new Date().toISOString()
    });
    localStorage.setItem(LOCAL_STORAGE_KEYS.PAYMENTS, JSON.stringify(list));
    notifyPayments();
    return id;
  }
  try {
    const docRef = await addDoc(collection(db, path), {
      ...payment,
      status: payment.status || 'pending',
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Verify or Reject a pending payment receipt
 */
export async function verifyPaymentInDb(paymentId: string, status: 'confirmed' | 'rejected', verifierName: string): Promise<void> {
  const path = `payments/${paymentId}`;
  if (isLocalMode()) {
    const list = getLocalPayments();
    const item = list.find(p => p.id === paymentId);
    if (item) {
      item.status = status;
      item.verifiedBy = verifierName;
      item.verifiedAt = new Date().toISOString();
      localStorage.setItem(LOCAL_STORAGE_KEYS.PAYMENTS, JSON.stringify(list));
      notifyPayments();
    }
    return;
  }
  try {
    const docRef = doc(db, 'payments', paymentId);
    await updateDoc(docRef, {
      status,
      verifiedBy: verifierName,
      verifiedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Delete a payment record
 */
export async function deletePaymentInDb(paymentId: string): Promise<void> {
  const path = `payments/${paymentId}`;
  if (isLocalMode()) {
    const list = getLocalPayments();
    const filtered = list.filter(p => p.id !== paymentId);
    localStorage.setItem(LOCAL_STORAGE_KEYS.PAYMENTS, JSON.stringify(filtered));
    notifyPayments();
    return;
  }
  try {
    await deleteDoc(doc(db, 'payments', paymentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Sync payments list
 */
export function syncPayments(onUpdate: (payments: Payment[]) => void, onError: (err: Error) => void) {
  if (isLocalMode()) {
    paymentsCallbacks.add(onUpdate);
    setTimeout(() => {
      onUpdate(getLocalPayments().sort((a,b) => b.date.localeCompare(a.date)));
    }, 50);
    return () => {
      paymentsCallbacks.delete(onUpdate);
    };
  }

  const path = 'payments';
  const q = query(collection(db, path));
  
  return onSnapshot(q, (snapshot) => {
    const list: Payment[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const rawStatus = data.status || 'confirmed';
      // Normalize legacy 'verified' state to 'confirmed'
      const status: 'pending' | 'confirmed' | 'rejected' = 
        (rawStatus === 'verified' || rawStatus === 'confirmed') ? 'confirmed' : rawStatus;

      list.push({
        id: doc.id,
        memberId: data.memberId || '',
        memberName: data.memberName || '',
        amount: Number(data.amount) || 0,
        note: data.note || '',
        date: data.date || '',
        createdAt: data.createdAt || '',
        status,
        proofUrl: data.proofUrl || '',
        receivedById: data.receivedById || '',
        receivedByName: data.receivedByName || '',
        verifiedAt: data.verifiedAt || '',
        verifiedBy: data.verifiedBy || ''
      });
    });
    // Sort by date descending
    list.sort((a, b) => b.date.localeCompare(a.date));
    onUpdate(list);
  }, (error) => {
    try {
      handleFirestoreError(error, OperationType.LIST, path);
    } catch (err) {
      onError(err as Error);
    }
  });
}

/**
 * Bulk generate remaining days meals of the current month
 * Generates active lunch + dinner for all active members
 */
export async function generateMealsForRemainderOfMonth(members: Member[], year: number, month: number): Promise<number> {
  const path = 'meals';
  if (isLocalMode()) {
    const activeMembers = members.filter(m => m.active);
    if (activeMembers.length === 0) return 0;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed
    const todayDay = now.getDate();

    // Determine starting day to generate from (today or first day)
    let startDay = 1;
    if (year === currentYear && month === currentMonth) {
      startDay = todayDay;
    }

    // Number of days in the requested month
    const totalDays = new Date(year, month, 0).getDate();
    
    // Fetch all existing meals for this month to avoid duplicates
    const monthStr = String(month).padStart(2, '0');
    const prefix = `${year}-${monthStr}`;

    const list = getLocalMeals();
    const existingKeys = new Set<string>();
    list.forEach(m => {
      if (m.date && m.date.startsWith(prefix)) {
        existingKeys.add(`${m.memberId}_${m.date}_${m.type}`);
      }
    });

    let generatedCount = 0;
    for (let day = startDay; day <= totalDays; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;

      for (const m of activeMembers) {
        // Generate Lunch
        const lunchKey = `${m.id}_${dateStr}_lunch`;
        if (!existingKeys.has(lunchKey)) {
          list.push({
            id: 'me_' + Date.now().toString() + Math.random().toString().substring(2,6),
            memberId: m.id,
            memberName: m.name,
            date: dateStr,
            type: 'lunch',
            status: 'active',
            createdAt: new Date().toISOString(),
            cancelledAt: null
          });
          generatedCount++;
        }

        // Generate Dinner
        const dinnerKey = `${m.id}_${dateStr}_dinner`;
        if (!existingKeys.has(dinnerKey)) {
          list.push({
            id: 'me_' + Date.now().toString() + Math.random().toString().substring(2,6),
            memberId: m.id,
            memberName: m.name,
            date: dateStr,
            type: 'dinner',
            status: 'active',
            createdAt: new Date().toISOString(),
            cancelledAt: null
          });
          generatedCount++;
        }
      }
    }
    localStorage.setItem(LOCAL_STORAGE_KEYS.MEALS, JSON.stringify(list));
    notifyMeals();
    return generatedCount;
  }

  try {
    const batch = writeBatch(db);
    const activeMembers = members.filter(m => m.active);
    if (activeMembers.length === 0) return 0;

    // Get current date details
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-indexed
    const todayDay = now.getDate();

    // Determine starting day to generate from (today or first day)
    let startDay = 1;
    if (year === currentYear && month === currentMonth) {
      startDay = todayDay;
    }

    // Number of days in the requested month
    const totalDays = new Date(year, month, 0).getDate();
    
    // Fetch all existing meals for this month to avoid duplicates
    const monthStr = String(month).padStart(2, '0');
    const prefix = `${year}-${monthStr}`;
    
    const mealSnap = await getDocs(collection(db, 'meals'));
    const existingKeys = new Set<string>();
    mealSnap.forEach((doc) => {
      const d = doc.data();
      if (d.date && d.date.startsWith(prefix)) {
        existingKeys.add(`${d.memberId}_${d.date}_${d.type}`);
      }
    });

    let generatedCount = 0;
    for (let day = startDay; day <= totalDays; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `${year}-${monthStr}-${dayStr}`;

      for (const m of activeMembers) {
        // Generate Lunch
        const lunchKey = `${m.id}_${dateStr}_lunch`;
        if (!existingKeys.has(lunchKey)) {
          const lRef = doc(collection(db, 'meals'));
          batch.set(lRef, {
            memberId: m.id,
            memberName: m.name,
            date: dateStr,
            type: 'lunch',
            status: 'active',
            createdAt: new Date().toISOString(),
            cancelledAt: null
          });
          generatedCount++;
        }

        // Generate Dinner
        const dinnerKey = `${m.id}_${dateStr}_dinner`;
        if (!existingKeys.has(dinnerKey)) {
          const dRef = doc(collection(db, 'meals'));
          batch.set(dRef, {
            memberId: m.id,
            memberName: m.name,
            date: dateStr,
            type: 'dinner',
            status: 'active',
            createdAt: new Date().toISOString(),
            cancelledAt: null
          });
          generatedCount++;
        }
      }
    }

    if (generatedCount > 0) {
      await batch.commit();
    }
    return generatedCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Bulk cancel for a date range for a single member
 */
export async function bulkCancelMealsInDb(memberId: string, memberName: string, startDate: string, endDate: string): Promise<number> {
  const path = 'meals';
  if (isLocalMode()) {
    const list = getLocalMeals();
    let cancelledCount = 0;
    list.forEach(item => {
      if (
        item.memberId === memberId &&
        item.date >= startDate &&
        item.date <= endDate &&
        item.status === 'active'
      ) {
        // Check if same-day cancel needs late mark
        const todayStr = new Date().toISOString().split('T')[0];
        let isLate = false;
        if (item.date === todayStr) {
          const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false }); // "HH:MM:SS"
          if (item.type === 'lunch' && nowStr >= '09:00:00') {
            isLate = true;
          } else if (item.type === 'dinner' && nowStr >= '17:00:00') {
            isLate = true;
          }
        }
        item.status = 'cancelled';
        item.cancelledAt = new Date().toISOString();
        item.late_cancel = isLate;
        cancelledCount++;
      }
    });
    localStorage.setItem(LOCAL_STORAGE_KEYS.MEALS, JSON.stringify(list));
    notifyMeals();
    return cancelledCount;
  }

  try {
    const q = query(
      collection(db, path),
      // Grab all meals to filter programmatically in JS (secure, simple, works on all Firestore setups)
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    let cancelledCount = 0;

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (
        data.memberId === memberId &&
        data.date >= startDate &&
        data.date <= endDate &&
        data.status === 'active'
      ) {
        // Check if same-day cancel needs late mark
        const todayStr = new Date().toISOString().split('T')[0];
        let isLate = false;
        if (data.date === todayStr) {
          const nowStr = new Date().toLocaleTimeString('en-US', { hour12: false }); // "HH:MM:SS"
          if (data.type === 'lunch' && nowStr >= '09:00:00') {
            isLate = true;
          } else if (data.type === 'dinner' && nowStr >= '17:00:00') {
            isLate = true;
          }
        }

        batch.update(docSnap.ref, {
          status: 'cancelled',
          cancelledAt: new Date().toISOString(),
          late_cancel: isLate
        });
        cancelledCount++;
      }
    });

    if (cancelledCount > 0) {
      await batch.commit();
    }
    return cancelledCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
