import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  doc, 
  updateDoc 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { 
  UtensilsCrossed, 
  Mail, 
  Lock, 
  User, 
  Phone, 
  Loader2, 
  ShieldCheck, 
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { motion } from 'motion/react';

interface AuthViewProps {
  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

export default function AuthView({ showToast }: AuthViewProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('warning', 'Please enter email and password.');
      return;
    }
    if (isSignUp && (!fullName || !phone)) {
      showToast('warning', 'Please fill in all signup details.');
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        // Create user in Firebase Auth
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const user = credential.user;

        // Set Display Name
        await updateProfile(user, { displayName: fullName.trim() });

        // Database association: check for existing member profile with same email
        const membersRef = collection(db, 'members');
        const q = query(membersRef, where('email', '==', email.trim().toLowerCase()));
        const snap = await getDocs(q);

        let associated = false;
        if (!snap.empty) {
          // Found existing member document with matching email, link it!
          const existingDoc = snap.docs[0];
          await updateDoc(doc(db, 'members', existingDoc.id), {
            uid: user.uid,
            name: fullName.trim(),
            phone: phone.trim(),
            active: true
          });
          associated = true;
          showToast('success', `Linked your account with existing roommate profile: ${fullName.trim()}!`);
        } else {
          // Check if there is an inactive roommate by the same name or just register brand new
          // Register brand new member in members collection
          await addDoc(collection(db, 'members'), {
            name: fullName.trim(),
            phone: phone.trim(),
            email: email.trim().toLowerCase(),
            uid: user.uid,
            active: true,
            joinDate: new Date().toISOString().split('T')[0]
          });
          showToast('success', `Sign Up successful! Registered new roommate profile: ${fullName.trim()}`);
        }
      } else {
        // Standard user login
        await signInWithEmailAndPassword(auth, email.trim(), password);
        showToast('success', 'Logged in successfully!');
      }
    } catch (err: any) {
      console.error(err);
      let errorMsg = err.message || 'An error occurred during authentication.';
      if (err.code === 'auth/email-already-in-use') {
        errorMsg = 'This email is already registered. Please sign in instead.';
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        errorMsg = 'Incorrect email or password credentials.';
      } else if (err.code === 'auth/weak-password') {
        errorMsg = 'Password must be at least 6 characters.';
      }
      showToast('error', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F1117] text-[#E8E9F3] flex flex-col items-center justify-center p-4 sm:p-6 transition-all select-none">
      <div className="w-full max-w-md space-y-6">
        
        {/* Logo and Greeting Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-[#6C63FF]/15 text-[#6C63FF] border border-[#6C63FF]/25 shadow-lg shadow-[#6C63FF]/5">
            <UtensilsCrossed className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              MealMate <span className="text-[#00D4AA] text-sm font-mono font-bold tracking-widest uppercase">Ledger</span>
            </h1>
            <p className="text-xs text-gray-500 font-mono">
              Bachelor Mess Meal & Expense Distribution Hub
            </p>
          </div>
        </div>

        {/* Card Body */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#1A1D2E] rounded-3xl border border-[#2D3142]/80 p-6 sm:p-8 shadow-2xl relative overflow-hidden space-y-6"
        >
          {/* Subtle decorative glowing grid patterns */}
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#6C63FF]/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#00D4AA]/5 rounded-full blur-3xl" />

          {/* Form Tabs */}
          <div className="flex bg-[#0F1117] p-1 rounded-xl border border-[#2D3142]/50">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setEmail('');
                setPassword('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                !isSignUp 
                  ? 'bg-[#6C63FF] text-white shadow-md' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setEmail('');
                setPassword('');
                setFullName('');
                setPhone('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                isSignUp 
                  ? 'bg-[#6C63FF] text-white shadow-md' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                {/* Full Name input */}
                <div className="space-y-1.5">
                  <label htmlFor="auth-fullname" className="block text-[10px] text-gray-400 font-mono uppercase tracking-wider">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                    <input
                      id="auth-fullname"
                      type="text"
                      placeholder="e.g. Shahriar Rahama"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2.5 pl-10 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#6C63FF] font-medium placeholder-gray-600"
                      required={isSignUp}
                    />
                  </div>
                </div>

                {/* Phone number input */}
                <div className="space-y-1.5">
                  <label htmlFor="auth-phone" className="block text-[10px] text-gray-400 font-mono uppercase tracking-wider">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                    <input
                      id="auth-phone"
                      type="tel"
                      placeholder="e.g. 01712345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2.5 pl-10 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#6C63FF] font-medium placeholder-gray-600"
                      required={isSignUp}
                    />
                  </div>
                </div>
              </>
            )}

            {/* Email Input */}
            <div className="space-y-1.5">
              <label htmlFor="auth-email" className="block text-[10px] text-gray-400 font-mono uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                <input
                  id="auth-email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2.5 pl-10 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#6C63FF] font-medium placeholder-gray-600"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label htmlFor="auth-password" className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                <input
                  id="auth-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2.5 pl-10 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#6C63FF] font-medium placeholder-gray-600"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="auth-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-3 bg-[#6C63FF] hover:bg-[#5b54e7] disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-[#6C63FF]/15 transition cursor-pointer mt-6"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isSignUp ? 'Create Roommate Account' : 'Sign In To Account'}</span>
                  <ChevronRight className="w-4 h-4 ml-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick Informative Banner */}
          <div className="pt-4 border-t border-[#2D3142]/40 text-center text-[10px] text-gray-550 leading-relaxed font-mono flex items-center justify-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#00D4AA] shrink-0" />
            <span>Secure real-time synchronization enabled</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
