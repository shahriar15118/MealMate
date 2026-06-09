import { useEffect, useState } from 'react';
import { Member, Meal, Payment, SettingsConfig } from '../types';
import { upsertMealInDb, db, verifyPaymentInDb } from '../firebase';
import { Users, Utensils, PiggyBank, CircleAlert, Check, X, Clock, CalendarHeart, History } from 'lucide-react';

interface DashboardViewProps {
  members: Member[];
  meals: Meal[];
  payments: Payment[];
  settings: SettingsConfig;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
  currentMember: Member | undefined;
}

export default function DashboardView({ members, meals, payments, settings, showToast, currentMember }: DashboardViewProps) {
  const [countdownText, setCountdownText] = useState('');
  const [deadlineWarning, setDeadlineWarning] = useState<string | null>(null);

  // UTC +6 / Local Bengali Calendar offset logic (Optional but classy Bengali touch)
  const getBengaliDate = (d: Date) => {
    // A simplified standard algorithm for English to Bengali Calendar conversion
    // June is Joishtho/Ashar. Let's provide a neat estimation of Bengali Season/Date
    const months = [
      'Boishakh', 'Jaishtha', 'Ashar', 'Shravan', 'Bhadra', 'Ashvin',
      'Kartik', 'Agrahayan', 'Poush', 'Magha', 'Falgun', 'Chaitra'
    ];
    // Offset standard (roughly Bengali year is English year - 593 or 594)
    const bYear = d.getFullYear() - 593;
    const bDay = d.getDate(); // approximate standard
    return `${bDay} ${months[(d.getMonth() + 2) % 12]}, ${bYear} BS`;
  };

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const currentMonthPrefix = todayStr.substring(0, 7); // e.g. "2026-06"

  // Live countdown to deadlines
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      const nowHours = now.getHours();
      const nowMinutes = now.getMinutes();

      // Lunch deadline today
      const [lHour, lMin] = settings.lunchCancelDeadline.split(':').map(Number);
      const [dHour, dMin] = settings.dinnerCancelDeadline.split(':').map(Number);

      const lunchDeadlineTime = new Date(now);
      lunchDeadlineTime.setHours(lHour, lMin, 0, 0);

      const dinnerDeadlineTime = new Date(now);
      dinnerDeadlineTime.setHours(dHour, dMin, 0, 0);

      if (now < lunchDeadlineTime) {
        const diffMs = lunchDeadlineTime.getTime() - now.getTime();
        const hrs = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        setCountdownText(`🍛 Lunch cancel deadline in ${hrs}h ${mins}m`);
        setDeadlineWarning(hrs === 0 && mins <= 30 ? 'Lunch cancellation deadline closes in under 30 minutes!' : null);
      } else if (now < dinnerDeadlineTime) {
        const diffMs = dinnerDeadlineTime.getTime() - now.getTime();
        const hrs = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        setCountdownText(`🌙 Dinner cancel deadline in ${hrs}h ${mins}m`);
        setDeadlineWarning(hrs === 0 && mins <= 45 ? 'Dinner cancellation deadline is approaching!' : null);
      } else {
        // Next day lunch deadline
        setCountdownText('🍛 All deadlines passed for today.');
        setDeadlineWarning(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [settings]);

  // Compute stats
  const activeMembers = members.filter(m => m.active);
  const totalMembersCount = activeMembers.length;

  // Filter meals for this month
  const thisMonthMeals = meals.filter(m => m.date.startsWith(currentMonthPrefix));
  
  // Total billable meals: active OR late cancelled (which still counts for money)
  const billableMealsThisMonth = thisMonthMeals.filter(m => m.status === 'active' || m.late_cancel);
  const totalBillableMealsCount = billableMealsThisMonth.length;
  const totalCollectionEst = totalBillableMealsCount * settings.mealCost;

  // Actual cash collected from verified/confirmed payments this month
  const actualCashCollectedThisMonth = payments
    .filter(p => p.status === 'confirmed' && p.date.startsWith(currentMonthPrefix))
    .reduce((sum, p) => sum + p.amount, 0);

  // Outstanding dues
  let totalDuesOutstanding = 0;
  members.forEach(member => {
    // Current month meals
    const memberMeals = thisMonthMeals.filter(m => m.memberId === member.id);
    const billableCount = memberMeals.filter(m => m.status === 'active' || m.late_cancel).length;
    const totalCost = billableCount * settings.mealCost;

    // Payments registered
    const memberPayments = payments.filter(p => p.memberId === member.id && p.date.startsWith(currentMonthPrefix));
    const totalPaid = memberPayments.filter(p => p.status === 'confirmed').reduce((sum, p) => sum + p.amount, 0);
    const balance = totalCost - totalPaid;
    if (balance > 0) {
      totalDuesOutstanding += balance;
    }
  });

  // Global pending transactions count
  const pendingPaymentsGlobally = payments.filter(p => p.status === 'pending');
  const pendingPaymentsAmount = pendingPaymentsGlobally.reduce((sum, p) => sum + p.amount, 0);

  // Today's summary
  const mealsToday = meals.filter(m => m.date === todayStr);
  const activeLunchToday = mealsToday.filter(m => m.type === 'lunch' && m.status === 'active').length;
  const activeDinnerToday = mealsToday.filter(m => m.type === 'dinner' && m.status === 'active').length;

  // Recent activity logs (Aggregate last 10 adjustments across meals & payments)
  const activityLogs: Array<{ id: string; type: 'meal' | 'payment'; text: string; time: string }> = [];

  meals.slice().sort((a,b) => (b.cancelledAt || b.createdAt).localeCompare(a.cancelledAt || a.createdAt)).forEach(meal => {
    const timestamp = meal.cancelledAt || meal.createdAt;
    if (meal.status === 'cancelled') {
      const lateStr = meal.late_cancel ? ' (⚠️ Late Cancel)' : '';
      activityLogs.push({
        id: `meal-cancel-${meal.id}`,
        type: 'meal',
        text: `Cancelled ${meal.memberName}'s ${meal.type} on ${meal.date}${lateStr}`,
        time: timestamp
      });
    } else {
      activityLogs.push({
        id: `meal-active-${meal.id}`,
        type: 'meal',
        text: `Booked ${meal.memberName}'s ${meal.type} on ${meal.date}`,
        time: timestamp
      });
    }
  });

  payments.forEach(pay => {
    const statusText = pay.status === 'confirmed' ? ' (Confirmed)' : pay.status === 'rejected' ? ' (Rejected)' : ' (Pending Verification)';
    activityLogs.push({
      id: `payment-${pay.id}`,
      type: 'payment',
      text: `Recorded ${pay.amount} BDT from ${pay.memberName}${statusText} - Note: ${pay.note || 'No note'}`,
      time: pay.createdAt
    });
  });

  // Sort unified activities desc
  const sortedActivities = activityLogs
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, 10);

  // Quick action meal toggling for today
  const handleQuickToggle = async (member: Member, mealType: 'lunch' | 'dinner', currentStatus: 'active' | 'cancelled') => {
    // Deadline checks
    const now = new Date();
    const [lHour, lMin] = settings.lunchCancelDeadline.split(':').map(Number);
    const [dHour, dMin] = settings.dinnerCancelDeadline.split(':').map(Number);

    let isLate = false;
    if (mealType === 'lunch') {
      const boundary = new Date();
      boundary.setHours(lHour, lMin, 0, 0);
      if (now >= boundary) isLate = true;
    } else {
      const boundary = new Date();
      boundary.setHours(dHour, dMin, 0, 0);
      if (now >= boundary) isLate = true;
    }

    const nextStatus = currentStatus === 'active' ? 'cancelled' : 'active';

    try {
      if (nextStatus === 'cancelled' && isLate) {
        showToast('warning', `⚠️ Deadline passed same-day meal cancel. This cancellation is recorded, but meal charge continues list.`);
      }
      await upsertMealInDb(member.id, member.name, todayStr, mealType, nextStatus, isLate);
      showToast('success', `${member.name}'s ${mealType} status updated to ${nextStatus}.`);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to update today meal checklist.');
    }
  };

  return (
    <div id="dashboard-view-container" className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between p-6 bg-gradient-to-r from-[#1A1D2E] to-[#20243E] rounded-2xl border border-[#2D3142]/60 gap-4 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#6C63FF] tracking-wider uppercase">
            <span className="flex h-2 w-2 rounded-full bg-[#00D4AA]" />
            Bachelor Household Active
          </div>
          <h1 className="text-2xl md:text-3xl font-sans font-extrabold text-[#E8E9F3] tracking-tight">
            MealMate Dashboard
          </h1>
          <div className="flex items-center gap-2 text-xs text-[#6B7280]">
            <CalendarHeart className="w-3.5 h-3.5 text-[#00D4AA]" />
            <span>Gregorian: {today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <span className="text-gray-600">|</span>
            <span className="text-amber-500 font-medium">Bengali: {getBengaliDate(today)}</span>
          </div>
        </div>

        {/* Live deadline countdown widget */}
        <div className="flex flex-col items-start md:items-end bg-[#0F1117] px-4 py-3 rounded-xl border border-[#2D3142] min-w-[210px] shadow-inner">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
            <Clock className="w-4 h-4 text-[#6C63FF]" />
            <span>Deadline Timer</span>
          </div>
          <span className="font-mono text-sm font-bold text-amber-500 mt-1">{countdownText}</span>
        </div>
      </div>

      {/* Deadline Approaches Warnings */}
      {deadlineWarning && (
        <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs font-semibold animate-pulse">
          <CircleAlert className="w-5 h-5" />
          <span>{deadlineWarning} Roommates should confirm cancellations immediately.</span>
        </div>
      )}

      {/* Stats Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Members */}
        <div className="bg-[#1A1D2E] p-4 rounded-xl border border-[#2D3142]/80 hover:border-[#6C63FF]/50 transition-all shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7280]">Total Roommates</span>
            <div className="p-2 rounded-lg bg-[#6C63FF]/15 text-[#6C63FF]">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-[#E8E9F3] tracking-tight font-mono">{totalMembersCount}</span>
            <p className="text-[10px] text-gray-500 mt-1">Active list members</p>
          </div>
        </div>

        {/* Active meals this month */}
        <div className="bg-[#1A1D2E] p-4 rounded-xl border border-[#2D3142]/80 hover:border-[#6C63FF]/50 transition-all shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7280]">Meals Eaten (Month)</span>
            <div className="p-2 rounded-lg bg-amber-500/15 text-amber-500">
              <Utensils className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-[#E8E9F3] tracking-tight font-mono">{totalBillableMealsCount}</span>
            <p className="text-[10px] text-gray-500 mt-1">Charged meals tracker</p>
          </div>
        </div>

        {/* Monthly Collection */}
        <div className="bg-[#1A1D2E] p-4 rounded-xl border border-[#2D3142]/80 hover:border-[#6C63FF]/50 transition-all shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7280]">Collection (Month)</span>
            <div className="p-2 rounded-lg bg-[#00D4AA]/15 text-[#00D4AA]">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-[#00D4AA] tracking-tight font-mono">{actualCashCollectedThisMonth} BDT</span>
            <p className="text-[10px] text-gray-500 mt-1">
              Target: <span className="font-semibold text-[#6C63FF] font-mono">{totalCollectionEst} BDT</span> (Eaten meals cost)
            </p>
          </div>
        </div>

        {/* Target dues */}
        <div className="bg-[#1A1D2E] p-4 rounded-xl border border-[#2D3142]/80 hover:border-[#FF6B6B]/50 transition-all shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#6B7280]">Outstanding Dues</span>
            <div className="p-2 rounded-lg bg-[#FF6B6B]/15 text-[#FF6B6B]">
              <CircleAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold text-[#FF6B6B] tracking-tight font-mono">{totalDuesOutstanding} BDT</span>
            {pendingPaymentsAmount > 0 ? (
              <p className="text-[10px] text-amber-500 mt-1 font-semibold leading-tight">
                ⚠️ {pendingPaymentsAmount} BDT pending verification
              </p>
            ) : (
              <p className="text-[10px] text-gray-500 mt-1">Outstanding roommate balances</p>
            )}
          </div>
        </div>
      </div>

      {/* ⏳ Pending Cash Handover Verifications */}
      <div className="bg-[#1A1D2E] p-6 rounded-2xl border border-[#2D3142]/60 shadow-lg space-y-4">
        <div className="flex items-center justify-between border-b border-[#2D3142]/60 pb-3">
          <div className="space-y-0.5">
            <h3 className="text-base font-extrabold text-[#E8E9F3] flex items-center gap-2">
              <span className={`flex h-2.5 w-2.5 rounded-full ${pendingPaymentsGlobally.length > 0 ? 'bg-amber-500 animate-ping' : 'bg-[#00D4AA]'}`} />
              ⏳ Pending Cash Handover Verifications
            </h3>
            <p className="text-xs text-gray-400">
              Confirm whether you physically received this cash from your roommates.
            </p>
          </div>
          <span className={`px-2.5 py-1 text-xs font-mono font-black rounded-lg ${
            pendingPaymentsGlobally.length > 0 
              ? 'text-[#F59E0B] bg-[#F59E0B]/10' 
              : 'text-[#00D4AA] bg-[#00D4AA]/10'
          }`}>
            {pendingPaymentsGlobally.length} Waiting
          </span>
        </div>

        {pendingPaymentsGlobally.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingPaymentsGlobally.map((pay) => (
              <div key={pay.id} className="bg-[#0F1117] p-4 rounded-xl border border-[#2D3142] flex flex-col justify-between space-y-3 shadow-md hover:border-amber-500/25 transition">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-[#00D4AA] font-mono">৳{pay.amount} BDT</span>
                    <span className="text-[10px] text-gray-500 font-mono">{pay.date}</span>
                  </div>
                  <p className="text-xs text-[#E8E9F3]">
                    From: <span className="font-bold text-[#6C63FF]">{pay.memberName}</span>
                  </p>
                  <p className="text-[11px] text-gray-400 italic">
                     "{pay.note || 'No custom note structure'}"
                  </p>
                  {pay.proofUrl && (
                    <div className="mt-2 rounded-lg overflow-hidden border border-[#2D3142] bg-[#1A1D2E]/50 p-1 flex items-center justify-between gap-1">
                      <span className="text-[9px] text-gray-400 font-mono">Receipt Attached:</span>
                      <a 
                        href={pay.proofUrl} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="text-[10px] text-[#00D4AA] hover:underline font-bold flex items-center gap-1"
                      >
                        <img 
                          src={pay.proofUrl} 
                          alt="Receipt Proof" 
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 object-cover rounded hover:scale-105 transition"
                        />
                        View Proof ↗
                      </a>
                    </div>
                  )}
                  <div className="text-[10px] text-amber-500 font-medium font-mono mt-0.5">
                    👉 Collector: {pay.receivedByName || 'Mess Manager'}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pt-2.5 border-t border-[#2D3142]/40 justify-end">
                  {currentMember && pay.receivedById === currentMember.id ? (
                    <>
                      <span className="text-[9px] text-gray-400 font-mono mr-auto">Verify receipt?</span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`Approve cash handover: Did you receive ৳${pay.amount} from ${pay.memberName}?`)) {
                            try {
                              await verifyPaymentInDb(pay.id, 'confirmed', pay.receivedByName || 'Mess Manager');
                              showToast('success', 'Cash payment successfully verified and credited to ledger!');
                            } catch (err) {
                              showToast('error', 'Could not verify payment.');
                            }
                          }
                        }}
                        className="px-2.5 py-1 text-[10px] font-bold text-[#0F1117] bg-[#00D4AA] hover:bg-[#00be98] rounded-md transition cursor-pointer"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`Reject/Dispute cash handover from ${pay.memberName}?`)) {
                            try {
                              await verifyPaymentInDb(pay.id, 'rejected', pay.receivedByName || 'Mess Manager');
                              showToast('warning', 'Disowned and rejected this cash handover record.');
                            } catch (err) {
                              showToast('error', 'Could not dispute payment.');
                            }
                          }
                        }}
                        className="px-2.5 py-1 text-[10px] font-bold text-white bg-[#FF6B6B] hover:bg-[#ff5252] rounded-md transition cursor-pointer"
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <span className="text-[10px] bg-[#2D3142]/30 text-gray-400 px-2.5 py-1 rounded-lg border border-[#2D3142]/50 font-mono w-full text-center">
                      🔒 Only {pay.receivedByName || 'selected roommate'} can verify this cash
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center text-xs text-gray-500 gap-2">
            <div className="w-10 h-10 rounded-full bg-[#00D4AA]/10 flex items-center justify-center text-[#00D4AA]">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-gray-300">All Cash Records Verified</span>
              <p className="text-[10px] text-gray-500 mt-0.5">
                No roommate handovers are waiting for confirmation. All cash logs have been reconciled!
              </p>
              <div className="mt-2.5 max-w-lg bg-[#0F1117] border border-[#2D3142]/60 p-3 rounded-xl text-[10px] text-amber-500 leading-normal font-sans mx-auto text-left">
                💡 <strong className="font-bold text-amber-400">How to create a pending verification:</strong> Go to the <span className="font-bold text-[#6C63FF]">Ledger Balances</span> tab, select a roommate, click <strong className="text-white">Record Cash Payment</strong>, fill in the amount, and under <strong className="text-white">"Who Received / Collected?"</strong>, select another active roommate (instead of holding it in the default "Direct to Mess Fund"). This will place the payment in <span className="underline select-all">pending state</span> until that roommate verifies they received it!
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Today's Status & Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left/Middle Column: Today's meal statuses */}
        <div className="lg:col-span-2 bg-[#1A1D2E] p-6 rounded-2xl border border-[#2D3142]/80 shadow-md">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2D3142]">
            <div>
              <h3 className="text-base font-bold text-[#E8E9F3] font-sans">Today's Meal Checklist</h3>
              <p className="text-xs text-[#6B7280]">Quickly log or cancel meals for today's lunch or dinner</p>
            </div>
            
            {/* Active Meals Counter badges */}
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-[10px] font-bold rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                🍛 Lunch: {activeLunchToday}
              </span>
              <span className="px-2.5 py-1 text-[10px] font-bold rounded bg-indigo-500/10 text-[#818CF8] border border-indigo-500/20">
                🌙 Dinner: {activeDinnerToday}
              </span>
            </div>
          </div>

          {activeMembers.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-500 space-y-2">
              <span>No active roommates registered in the household. Go to "Settings" to add members first.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#2D3142]/55 text-gray-400 font-mono">
                    <th className="py-2.5 font-semibold">Roommate</th>
                    <th className="py-2.5 text-center font-semibold">Lunch (🍛)</th>
                    <th className="py-2.5 text-center font-semibold">Dinner (🌙)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2D3142]/40">
                  {activeMembers.map((member) => {
                    const lunchMeal = mealsToday.find(m => m.memberId === member.id && m.type === 'lunch');
                    const dinnerMeal = mealsToday.find(m => m.memberId === member.id && m.type === 'dinner');

                    const lunchStatus = lunchMeal ? lunchMeal.status : 'active'; // Default active
                    const dinnerStatus = dinnerMeal ? dinnerMeal.status : 'active'; // Default active

                    const isLunchLateCancel = lunchMeal?.late_cancel;
                    const isDinnerLateCancel = dinnerMeal?.late_cancel;

                    return (
                      <tr key={member.id} id={`row-member-${member.id}`} className="hover:bg-[#202336]/40 transition-all">
                        <td className="py-3 font-medium text-[#E8E9F3]">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#6C63FF]/20 text-[#6C63FF] flex items-center justify-center font-bold text-xs uppercase shadow-sm">
                              {member.name.charAt(0)}
                            </div>
                            <div>
                              <span>{member.name}</span>
                              <span className="block text-[10px] text-gray-500 font-mono tracking-wider">{member.phone}</span>
                            </div>
                          </div>
                        </td>
                        
                        {/* Lunch Status Column */}
                        <td className="py-3 text-center">
                          <button
                            id={`quick-toggle-${member.id}-lunch`}
                            type="button"
                            onClick={() => handleQuickToggle(member, 'lunch', lunchStatus)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all inline-flex items-center gap-1 cursor-pointer ${
                              lunchStatus === 'active'
                                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20'
                                : isLunchLateCancel
                                ? 'bg-[#FF6B6B]/15 text-[#FF6B6B] border-[#FF6B6B]/25 hover:bg-[#FF6B6B]/25'
                                : 'bg-[#2D3142]/40 text-gray-500 border-transparent hover:bg-[#2D3142]/70'
                            }`}
                          >
                            {lunchStatus === 'active' ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Active</span>
                              </>
                            ) : isLunchLateCancel ? (
                              <>
                                <X className="w-3 h-3" />
                                <span>Cancelled ⚠️</span>
                              </>
                            ) : (
                              <>
                                <X className="w-3 h-3" />
                                <span>Cancelled</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Dinner Status Column */}
                        <td className="py-3 text-center">
                          <button
                            id={`quick-toggle-${member.id}-dinner`}
                            type="button"
                            onClick={() => handleQuickToggle(member, 'dinner', dinnerStatus)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all inline-flex items-center gap-1 cursor-pointer ${
                              dinnerStatus === 'active'
                                ? 'bg-indigo-500/10 text-[#818CF8] border-indigo-500/20 hover:bg-indigo-500/20'
                                : isDinnerLateCancel
                                ? 'bg-[#FF6B6B]/15 text-[#FF6B6B] border-[#FF6B6B]/25 hover:bg-[#FF6B6B]/25'
                                : 'bg-[#2D3142]/40 text-gray-500 border-transparent hover:bg-[#2D3142]/70'
                            }`}
                          >
                            {dinnerStatus === 'active' ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>Active</span>
                              </>
                            ) : isDinnerLateCancel ? (
                              <>
                                <X className="w-3 h-3" />
                                <span>Cancelled ⚠️</span>
                              </>
                            ) : (
                              <>
                                <X className="w-3 h-3" />
                                <span>Cancelled</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right Column: Activity Feed */}
        <div className="bg-[#1A1D2E] p-6 rounded-2xl border border-[#2D3142]/80 shadow-md">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#2D3142]">
            <History className="w-4 h-4 text-[#6C63FF]" />
            <h3 className="text-base font-bold text-[#E8E9F3] font-sans">Recent Log Activities</h3>
          </div>

          {sortedActivities.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-500">
              No recent activities. Actions will be logged here in real-time.
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
              {sortedActivities.map((act) => (
                <div key={act.id} className="flex gap-2.5 items-start text-xs border-l-2 border-[#2D3142] pl-3 py-0.5">
                  <div className="flex-1 space-y-0.5">
                    <p className="text-gray-350 leading-relaxed">{act.text}</p>
                    <span className="block text-[10px] text-gray-500 font-mono">
                      {new Date(act.time).toLocaleString('en-US', { hour12: true, hour: 'numeric', minute: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
