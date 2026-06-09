import React, { useState } from 'react';
import { Member, Meal, Payment, SettingsConfig } from '../types';
import { updateSettingsInDb, addMemberInDb, toggleMemberActiveInDb } from '../firebase';
import { Settings, UserPlus, ToggleLeft, ToggleRight, Download, BookOpen, Printer, CheckCircle, Scale, DollarSign, CalendarRange, Clock } from 'lucide-react';

interface SettingsAdminTabProps {
  members: Member[];
  meals: Meal[];
  payments: Payment[];
  settings: SettingsConfig;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export default function SettingsAdminTab({ members, meals, payments, settings, showToast }: SettingsAdminTabProps) {
  // Config state
  const [mealCost, setMealCost] = useState(settings.mealCost);
  const [lunchDeadline, setLunchDeadline] = useState(settings.lunchCancelDeadline);
  const [dinnerDeadline, setDinnerDeadline] = useState(settings.dinnerCancelDeadline);
  const [updatingConfig, setUpdatingConfig] = useState(false);

  // New member state
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberJoinDate, setNewMemberJoinDate] = useState(new Date().toISOString().split('T')[0]);
  const [addingMember, setAddingMember] = useState(false);

  // Summary Report Modal State
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryMonth, setSummaryMonth] = useState(new Date().toISOString().slice(0, 7)); // "YYYY-MM"

  // Save Settings Config
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealCost || mealCost <= 0) {
      showToast('warning', 'Please enter a valid meal cost.');
      return;
    }

    setUpdatingConfig(false);
    try {
      setUpdatingConfig(true);
      await updateSettingsInDb({
        mealCost: Number(mealCost),
        lunchCancelDeadline: lunchDeadline,
        dinnerCancelDeadline: dinnerDeadline
      });
      showToast('success', 'Global configurations updated successfully.');
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to save configurations.');
    } finally {
      setUpdatingConfig(false);
    }
  };

  // Add Roommate
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim() || !newMemberPhone.trim()) {
      showToast('warning', 'Please fill in roommate name and phone contact.');
      return;
    }

    setAddingMember(false);
    try {
      setAddingMember(true);
      await addMemberInDb(newMemberName.trim(), newMemberPhone.trim(), newMemberJoinDate);
      showToast('success', `Roommate ${newMemberName} successfully registered in household.`);
      setNewMemberName('');
      setNewMemberPhone('');
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to add roommate.');
    } finally {
      setAddingMember(false);
    }
  };

  // Deactivate/Reactivate Roommate
  const handleToggleMemberActive = async (memberId: string, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'reactivate';
    if (!confirm(`Are you sure you want to ${action} this roommate?`)) return;

    try {
      await toggleMemberActiveInDb(memberId, !currentStatus);
      showToast('success', `Roommate status successfully modified to ${!currentStatus ? 'Active' : 'Inactive'}.`);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to toggle roommate status.');
    }
  };

  // CSV Exporter: Monthly Ledger
  const handleExportMonthlyLedger = () => {
    const activePeriod = summaryMonth; // "YYYY-MM"
    const periodMeals = meals.filter(m => m.date.startsWith(activePeriod));
    const periodPayments = payments.filter(p => p.date.startsWith(activePeriod));

    const csvRows = [
      ['Member Name', 'Total Lunch', 'Total Dinner', 'Total Meals', 'Total Cost (BDT)', 'Total Paid (BDT)', 'Balance Due (BDT)']
    ];

    members.forEach(m => {
      const memberMeals = periodMeals.filter(meal => meal.memberId === m.id);
      
      const lunchCount = memberMeals.filter(meal => meal.type === 'lunch' && (meal.status === 'active' || meal.late_cancel)).length;
      const dinnerCount = memberMeals.filter(meal => meal.type === 'dinner' && (meal.status === 'active' || meal.late_cancel)).length;
      
      const totalMeals = lunchCount + dinnerCount;
      const totalCost = totalMeals * settings.mealCost;
      
      const totalPaid = periodPayments.filter(p => p.memberId === m.id).reduce((sum, p) => sum + p.amount, 0);
      const dues = totalCost - totalPaid;

      csvRows.push([
        m.name,
        String(lunchCount),
        String(dinnerCount),
        String(totalMeals),
        String(totalCost),
        String(totalPaid),
        String(dues)
      ]);
    });

    const csvContent = csvRows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MealMate_Monthly_Ledger_${activePeriod}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Downloaded Monthly Ledger CSV successfully.');
  };

  // CSV Exporter: Detailed Meals History
  const handleExportDetailedMeals = () => {
    const activePeriod = summaryMonth; // "YYYY-MM"
    const periodMeals = meals.filter(m => m.date.startsWith(activePeriod));

    const csvRows = [
      ['Date', 'Member Name', 'Lunch Status', 'Dinner Status', 'Daily Cost (BDT)', 'Late Cancellations']
    ];

    // Group meals by date and memberId
    const grouped: { [key: string]: { date: string; memberName: string; lunch: string; dinner: string; cost: number; late: string } } = {};

    periodMeals.forEach(meal => {
      const key = `${meal.date}_${meal.memberId}`;
      if (!grouped[key]) {
        grouped[key] = {
          date: meal.date,
          memberName: meal.memberName,
          lunch: 'Skipped',
          dinner: 'Skipped',
          cost: 0,
          late: ''
        };
      }

      const info = grouped[key];
      if (meal.type === 'lunch') {
        if (meal.status === 'active') {
          info.lunch = 'Eaten';
          info.cost += settings.mealCost;
        } else if (meal.late_cancel) {
          info.lunch = 'Late Cancelled';
          info.cost += settings.mealCost;
          info.late += 'Lunch ';
        }
      } else {
        if (meal.status === 'active') {
          info.dinner = 'Eaten';
          info.cost += settings.mealCost;
        } else if (meal.late_cancel) {
          info.dinner = 'Late Cancelled';
          info.cost += settings.mealCost;
          info.late += 'Dinner ';
        }
      }
    });

    Object.values(grouped)
      .sort((a,b) => b.date.localeCompare(a.date))
      .forEach(row => {
        csvRows.push([
          row.date,
          row.memberName,
          row.lunch,
          row.dinner,
          String(row.cost),
          row.late.trim().replace(/ /g, ', ') || 'None'
        ]);
      });

    const csvContent = csvRows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `MealMate_Detailed_Meals_${activePeriod}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('success', 'Downloaded Detailed Meals Export CSV.');
  };

  // Compile calculations for Close Month report
  const compileSummaryData = () => {
    const periodMeals = meals.filter(m => m.date.startsWith(summaryMonth));
    const periodPayments = payments.filter(p => p.date.startsWith(summaryMonth));

    let totalHouseholdCost = 0;
    let totalHouseholdPaid = 0;
    let totalHouseholdDues = 0;

    const rowData = members.map(m => {
      const memberMeals = periodMeals.filter(meal => meal.memberId === m.id);
      
      const lunchCount = memberMeals.filter(meal => meal.type === 'lunch' && (meal.status === 'active' || meal.late_cancel)).length;
      const dinnerCount = memberMeals.filter(meal => meal.type === 'dinner' && (meal.status === 'active' || meal.late_cancel)).length;
      
      const totalMealsCount = lunchCount + dinnerCount;
      const totalCost = totalMealsCount * settings.mealCost;
      
      const totalPaid = periodPayments.filter(p => p.memberId === m.id).reduce((sum, p) => sum + p.amount, 0);
      const balance = totalCost - totalPaid;

      totalHouseholdCost += totalCost;
      totalHouseholdPaid += totalPaid;
      if (balance > 0) {
        totalHouseholdDues += balance;
      }

      return {
        name: m.name,
        active: m.active,
        lunchCount,
        dinnerCount,
        totalMealsCount,
        totalCost,
        totalPaid,
        balance
      };
    });

    return { rowData, totalHouseholdCost, totalHouseholdPaid, totalHouseholdDues };
  };

  const summary = compileSummaryData();

  return (
    <div id="settings-admin-container" className="space-y-6">
      
      {/* Upper Grid: Config parameters & Add New roommate profile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Rules & config */}
        <div className="bg-[#1A1D2E] p-6 rounded-2xl border border-[#2D3142]/80 shadow-md space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#E8E9F3] font-sans flex items-center gap-1.5">
              <Settings className="w-5 h-5 text-[#6C63FF]" />
              Rules & Configurations Form
            </h3>
            <p className="text-xs text-[#6B7280]">Edit billing multipliers and daily roster cancellation timeouts</p>
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div>
              <label htmlFor="config-meal-cost" className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-[#6C63FF]" /> Cost per meal (BDT)
              </label>
              <input
                id="config-meal-cost"
                type="number"
                value={mealCost}
                onChange={(e) => setMealCost(Number(e.target.value))}
                className="w-full bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6C63FF]"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="config-lunch-deadline" className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" /> Lunch cutoff
                </label>
                <input
                  id="config-lunch-deadline"
                  type="time"
                  value={lunchDeadline}
                  onChange={(e) => setLunchDeadline(e.target.value)}
                  className="w-full bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6C63FF]"
                  required
                />
              </div>

              <div>
                <label htmlFor="config-dinner-deadline" className="block text-xs font-semibold text-gray-400 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" /> Dinner cutoff
                </label>
                <input
                  id="config-dinner-deadline"
                  type="time"
                  value={dinnerDeadline}
                  onChange={(e) => setDinnerDeadline(e.target.value)}
                  className="w-full bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2 rounded-lg focus:outline-none"
                  required
                />
              </div>
            </div>

            <button
              id="save-config-submit"
              type="submit"
              disabled={updatingConfig}
              className="w-full py-2 bg-[#6C63FF] hover:bg-[#5b54e7] transition text-white text-xs font-bold rounded-lg shrink-0 cursor-pointer disabled:opacity-50"
            >
              {updatingConfig ? 'Saving Parameters...' : 'Save Rule Configuration'}
            </button>
          </form>
        </div>

        {/* Register roommate form */}
        <div className="bg-[#1A1D2E] p-6 rounded-2xl border border-[#2D3142]/80 shadow-md space-y-4 font-sans">
          <div>
            <h3 className="text-base font-bold text-[#E8E9F3] flex items-center gap-1.5">
              <UserPlus className="w-5 h-5 text-[#00D4AA]" />
              Register Roommate profile
            </h3>
            <p className="text-xs text-[#6B7280]">Add another roommate to start scheduling their meals</p>
          </div>

          <form onSubmit={handleAddMember} className="space-y-3.5">
            <div>
              <label htmlFor="new-roommate-name" className="block text-xs font-semibold text-gray-400 mb-1">Roommate Name</label>
              <input
                id="new-roommate-name"
                type="text"
                placeholder="e.g. Sajid Rahman"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                className="w-full bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2 rounded-lg focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="new-roommate-phone" className="block text-xs font-semibold text-gray-400 mb-1">Phone Contact</label>
                <input
                  id="new-roommate-phone"
                  type="text"
                  placeholder="e.g. 0171234..."
                  value={newMemberPhone}
                  onChange={(e) => setNewMemberPhone(e.target.value)}
                  className="w-full bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2 rounded-lg focus:outline-none"
                  required
                />
              </div>

              <div>
                <label htmlFor="new-roommate-joindate" className="block text-xs font-semibold text-gray-400 mb-1">Join Date</label>
                <input
                  id="new-roommate-joindate"
                  type="date"
                  value={newMemberJoinDate}
                  onChange={(e) => setNewMemberJoinDate(e.target.value)}
                  className="w-full bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] text-xs px-2 py-1.5 rounded-lg focus:outline-none"
                  required
                />
              </div>
            </div>

            <button
              id="add-roommate-submit"
              type="submit"
              disabled={addingMember}
              className="w-full py-2 bg-[#00D4AA] hover:bg-[#00be98] transition text-[#0F1117] font-bold text-xs rounded-lg cursor-pointer"
            >
              {addingMember ? 'Registering Roommate...' : 'Register Roommate'}
            </button>
          </form>
        </div>

      </div>

      {/* Under Grid: Member roster table list and Ledgers export dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Roommates status administration */}
        <div className="lg:col-span-2 bg-[#1A1D2E] p-6 rounded-2xl border border-[#2D3142]/80 shadow-md">
          <h3 className="text-base font-bold text-[#E8E9F3] mb-4 pb-1 border-b border-[#2D3142]/45">Roommates Allocation Control</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#2D3142]/55 text-gray-400 font-mono">
                  <th className="py-2">Roommate</th>
                  <th className="py-2">Phone</th>
                  <th className="py-2">Join Date</th>
                  <th className="py-2 text-right">Status Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2D3142]/35">
                {members.map(m => (
                  <tr key={m.id} id={`admin-member-row-${m.id}`} className="hover:bg-[#202336]/40 transition">
                    <td className="py-3 font-semibold text-[#E8E9F3]">{m.name}</td>
                    <td className="py-3 font-mono text-gray-400">{m.phone}</td>
                    <td className="py-3 font-mono text-gray-400">{m.joinDate}</td>
                    <td className="py-3 text-right">
                      <button
                        id={`toggle-active-btn-${m.id}`}
                        type="button"
                        onClick={() => handleToggleMemberActive(m.id, m.active)}
                        className={`inline-flex items-center gap-1.5 text-xs font-bold rounded-lg px-2.5 py-1.5 transition cursor-pointer border ${
                          m.active
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/25'
                            : 'bg-gray-500/10 text-gray-400 border-gray-500/20 hover:bg-gray-500/25'
                        }`}
                      >
                        {m.active ? (
                          <>
                            <ToggleRight className="w-4 h-4 shrink-0 text-emerald-400" />
                            <span>Active</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-4 h-4 shrink-0 text-gray-400" />
                            <span>Inactive</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column: Export logs & summaries */}
        <div className="bg-[#1A1D2E] p-6 rounded-2xl border border-[#2D3142]/80 shadow-md space-y-4">
          <h3 className="text-base font-bold text-[#E8E9F3] pb-1 border-b border-[#2D3142]/45">Export Desk & Reports</h3>
          
          <div className="space-y-4 pt-1">
            {/* Filter period */}
            <div className="space-y-1">
              <label htmlFor="settings-report-month" className="text-[10px] text-gray-500 font-mono block">Selected report month period</label>
              <input
                id="settings-report-month"
                type="month"
                value={summaryMonth}
                onChange={(e) => setSummaryMonth(e.target.value)}
                className="w-full bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2 rounded-lg"
              />
            </div>

            {/* Close Month modal activator */}
            <button
              id="activate-close-month"
              type="button"
              onClick={() => setShowSummaryModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#6C63FF] hover:bg-[#5b54e7] text-white text-xs font-bold rounded-xl shadow-lg transition cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Close Month &amp; Summary</span>
            </button>

            {/* CSV Exports */}
            <div className="space-y-2 pt-2 border-t border-[#2D3142]/50">
              <span className="block text-[10px] uppercase font-bold text-gray-500 font-mono tracking-wider">Export spreadsheets</span>
              
              <button
                id="export-ledger-csv"
                type="button"
                onClick={handleExportMonthlyLedger}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-[#0F1117] hover:bg-[#15192A] border border-[#2D3142] hover:border-[#6C63FF]/30 text-xs text-[#E8E9F3] rounded-lg transition"
              >
                <span>Monthly Ledger Worksheet</span>
                <Download className="w-4 h-4 text-[#00D4AA]" />
              </button>

              <button
                id="export-meals-csv"
                type="button"
                onClick={handleExportDetailedMeals}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-[#0F1117] hover:bg-[#15192A] border border-[#2D3142] hover:border-[#6C63FF]/30 text-xs text-[#E8E9F3] rounded-lg transition"
              >
                 <span>Detailed Meals Worksheet</span>
                 <Download className="w-4 h-4 text-amber-500" />
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Summary Close Month Report Modal Popup */}
      {showSummaryModal && (
        <div id="summary-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F1117]/85 backdrop-blur-md">
          <div 
            id="summary-report-modal"
            className="w-full max-w-3xl overflow-hidden rounded-2xl bg-[#1A1D2E] border border-[#2D3142] shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-[#2D3142]/60 flex items-center justify-between bg-[#1f2238]/60">
              <div className="space-y-0.5">
                <h3 className="text-lg font-bold text-[#E8E9F3] font-sans">Close Month Worksheet ({summaryMonth})</h3>
                <p className="text-xs text-gray-500">Official physical report generated for household settlements</p>
              </div>
              <button
                id="close-summary-report-btn"
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="text-gray-400 hover:text-white transition px-2.5 py-1.5 bg-[#0F1117] rounded-lg text-xs font-semibold"
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Scroll Body (Formulated for printing as well) */}
            <div id="printable-summary-area" className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
              
              {/* Report Header (Visual when printed) */}
              <div className="hidden border-b-2 border-slate-800 pb-4 mb-4 text-black font-sans print:block">
                <h1 className="text-2xl font-bold text-center">MEALMATE FINANCES STATEMENT</h1>
                <p className="text-center text-xs tracking-wider">Statement Period: {summaryMonth} | Generated: {new Date().toLocaleDateString()}</p>
              </div>

              {/* Total Aggregate grid */}
              <div className="grid grid-cols-3 gap-4 border border-[#2D3142]/60 p-4 rounded-xl bg-[#0F1117] font-mono text-center">
                <div>
                  <span className="text-[10px] text-gray-500 block">Aggregate Outlay</span>
                  <span className="text-base font-bold text-[#E8E9F3]">৳{summary.totalHouseholdCost}</span>
                </div>
                <div className="border-x border-[#2D3142]/50">
                  <span className="text-[10px] text-gray-500 block">Total Payments Received</span>
                  <span className="text-base font-bold text-[#00D4AA]">৳{summary.totalHouseholdPaid}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block">Target Outstanding</span>
                  <span className="text-base font-bold text-[#FF6B6B]">৳{summary.totalHouseholdDues}</span>
                </div>
              </div>

              {/* Statement List of Roommates */}
              <div className="overflow-x-auto pt-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#2D3142] text-gray-450 font-mono">
                      <th className="py-2">Roommate</th>
                      <th className="py-2 text-center text-amber-500">Lunches</th>
                      <th className="py-2 text-center text-indigo-400">Dinners</th>
                      <th className="py-2 text-center">Total Meals</th>
                      <th className="py-2 text-right">Debit Cost</th>
                      <th className="py-2 text-right text-[#00D4AA]">Credit Paid</th>
                      <th className="py-2 text-right">Balance Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2D3142]/40 font-mono">
                    {summary.rowData.map((row) => (
                      <tr key={row.name} className="hover:bg-slate-800/20">
                        <td className="py-3 font-sans font-bold text-[#E8E9F3]">{row.name} {!row.active && <span className="text-[9px] text-gray-500 font-mono font-normal">(inc.)</span>}</td>
                        <td className="py-3 text-center">{row.lunchCount}</td>
                        <td className="py-3 text-center">{row.dinnerCount}</td>
                        <td className="py-3 text-center font-bold">{row.totalMealsCount}</td>
                        <td className="py-3 text-right">৳{row.totalCost}</td>
                        <td className="py-3 text-right text-[#00D4AA]">৳{row.totalPaid}</td>
                        <td className={`py-3 text-right font-bold ${
                          row.balance <= 0 ? 'text-[#00D4AA]' : 'text-[#FF6B6B]'
                        }`}>
                          {row.balance <= 0 ? 'Settled ' : `৳${row.balance}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Legal confirmation notice print block */}
              <div className="pt-8 text-[11px] text-gray-500 space-y-4 print:block">
                <div className="flex justify-between font-medium pt-8 mt-4 border-t border-[#2D3142]/40">
                  <div className="text-center w-1/3">
                    <span className="block border-t border-[#2D3142] pt-1 mx-auto w-24">Prepared By</span>
                  </div>
                  <div className="text-center w-1/3">
                    <span className="block border-t border-[#2D3142] pt-1 mx-auto w-24">Audit Confirmed</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#0F1117] border-t border-[#2D3142]/65 flex justify-between gap-3">
              <button
                id="summary-print-btn"
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-500 text-[#0F1117] hover:opacity-90 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Physical Statement</span>
              </button>

              <button
                id="summary-csv-btn"
                type="button"
                onClick={handleExportMonthlyLedger}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1A1D2E] hover:bg-[#20243E] border border-[#2D3142] text-xs font-bold text-[#E8E9F3] rounded-xl transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export CSV Report</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
