import React, { useState } from 'react';
import { Member, Meal, SettingsConfig } from '../types';
import { upsertMealInDb, generateMealsForRemainderOfMonth, bulkCancelMealsInDb } from '../firebase';
import { Sparkles, CalendarRange, Clock, AlertTriangle, User, CalendarDays, Utensils, Check, RotateCcw } from 'lucide-react';

interface MealManagementTabProps {
  members: Member[];
  meals: Meal[];
  settings: SettingsConfig;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export default function MealManagementTab({ members, meals, settings, showToast }: MealManagementTabProps) {
  // Single meal form
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedMealType, setSelectedMealType] = useState<'lunch' | 'dinner'>('lunch');
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'cancelled'>('active');

  // Bulk cancel form
  const [bulkMemberId, setBulkMemberId] = useState('');
  const [bulkStartDate, setBulkStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkEndDate, setBulkEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Loading states
  const [generating, setGenerating] = useState(false);
  const [bulkCancelling, setBulkCancelling] = useState(false);
  const [savingMeal, setSavingMeal] = useState(false);

  const activeMembers = members.filter(m => m.active);

  // Submit single custom meal entry
  const handleSubmitSingleMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) {
      showToast('warning', 'Please select a roommate.');
      return;
    }

    const member = members.find(m => m.id === selectedMemberId);
    if (!member) return;

    setSavingMeal(false);
    try {
      setSavingMeal(true);
      // Same-day deadline checks
      const todayStr = new Date().toISOString().split('T')[0];
      let isLate = false;

      if (selectedDate === todayStr && selectedStatus === 'cancelled') {
        const now = new Date();
        const [lHour, lMin] = settings.lunchCancelDeadline.split(':').map(Number);
        const [dHour, dMin] = settings.dinnerCancelDeadline.split(':').map(Number);

        if (selectedMealType === 'lunch') {
          const boundary = new Date();
          boundary.setHours(lHour, lMin, 0, 0);
          if (now >= boundary) isLate = true;
        } else {
          const boundary = new Date();
          boundary.setHours(dHour, dMin, 0, 0);
          if (now >= boundary) isLate = true;
        }
      }

      // Past date warning
      if (selectedDate < todayStr) {
        showToast('info', 'Past date adjustment: Admin status override recorded for historical tracking.');
      }

      if (selectedStatus === 'cancelled' && isLate) {
        showToast('warning', `⚠️ Deadline passed same-day meal cancel. This cancellation is recorded, but meal charge continues.`);
      }

      await upsertMealInDb(member.id, member.name, selectedDate, selectedMealType, selectedStatus, isLate);
      showToast('success', `Meal entry for ${member.name} on ${selectedDate} set to ${selectedStatus}.`);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to update custom meal entry.');
    } finally {
      setSavingMeal(false);
    }
  };

  // Generate for remainder of month
  const handleGenerateMonthMeals = async () => {
    if (activeMembers.length === 0) {
      showToast('warning', 'No active roommates registered. Please add active members before seeding logs.');
      return;
    }

    const todayDate = new Date();
    const curYear = todayDate.getFullYear();
    const curMonth = todayDate.getMonth() + 1;

    if (!confirm(`Generate active lunch and dinner rosters for all ${activeMembers.length} active roommates for the remainder of this month (${curYear}-${String(curMonth).padStart(2, '0')})?`)) {
      return;
    }

    setGenerating(false);
    try {
      setGenerating(true);
      const count = await generateMealsForRemainderOfMonth(members, curYear, curMonth);
      showToast('success', `🚀 Successfully initialized ${count} active meal allocations for this month.`);
    } catch (err) {
      console.error(err);
      showToast('error', 'Bulk generation operation crashed. Try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Submit bulk cancel date range
  const handleBulkCancelRange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkMemberId) {
      showToast('warning', 'Please select a roommate for vacation cancel.');
      return;
    }
    if (bulkStartDate > bulkEndDate) {
      showToast('warning', 'Start date must be earlier than or equal to End date.');
      return;
    }

    const member = members.find(m => m.id === bulkMemberId);
    if (!member) return;

    if (!confirm(`Cancel all active meals for ${member.name} from ${bulkStartDate} to ${bulkEndDate}?`)) return;

    setBulkCancelling(false);
    try {
      setBulkCancelling(true);
      const cancelledCount = await bulkCancelMealsInDb(bulkMemberId, member.name, bulkStartDate, bulkEndDate);
      if (cancelledCount === 0) {
        showToast('info', `No active meals found in specified date range for ${member.name}.`);
      } else {
        showToast('success', `✔ Cancelled ${cancelledCount} active meals for ${member.name} (Vacation schedule saved).`);
      }
    } catch (err) {
      console.error(err);
      showToast('error', 'Bulk vacation cancellation failed.');
    } finally {
      setBulkCancelling(false);
    }
  };

  return (
    <div id="meal-management-container" className="grid grid-cols-1 md:grid-cols-2 gap-6">

      {/* Left side: Single Custom Meal Schedule Scheduler */}
      <div className="bg-[#1A1D2E] p-6 rounded-2xl border border-[#2D3142]/80 shadow-xl space-y-5">
        <div>
          <h3 className="text-base font-bold text-[#E8E9F3] font-sans flex items-center gap-1.5">
            <Utensils className="w-5 h-5 text-amber-500" />
            Roster Entry Scheduler
          </h3>
          <p className="text-xs text-[#6B7280]">Book or skip individual meals manually on any given calendar date</p>
        </div>

        <form onSubmit={handleSubmitSingleMeal} className="space-y-4">
          {/* Roommate selector */}
          <div className="space-y-1.5">
            <label htmlFor="schedule-member-select" className="text-xs text-gray-400 font-semibold font-sans flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-[#6C63FF]" /> Roommate
            </label>
            <select
              id="schedule-member-select"
              value={selectedMemberId}
              onChange={(e) => setSelectedMemberId(e.target.value)}
              className="w-full bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6C63FF] font-medium"
              required
            >
              <option value="">Select Roommate</option>
              {activeMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Calendar Date selector */}
            <div className="space-y-1.5">
              <label htmlFor="schedule-date-input" className="text-xs text-gray-400 font-semibold font-sans flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5 text-[#6C63FF]" /> Date
              </label>
              <input
                id="schedule-date-input"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6C63FF] font-mono"
                required
              />
            </div>

            {/* Type selector */}
            <div className="space-y-1.5">
              <label htmlFor="schedule-type-select" className="text-xs text-gray-400 font-semibold font-sans flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#6C63FF]" /> Slot Type
              </label>
              <select
                id="schedule-type-select"
                value={selectedMealType}
                onChange={(e) => setSelectedMealType(e.target.value as 'lunch' | 'dinner')}
                className="w-full bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6C63FF] font-medium"
              >
                <option value="lunch">🍛 Lunch</option>
                <option value="dinner">🌙 Dinner</option>
              </select>
            </div>
          </div>

          {/* Status selector */}
          <div className="space-y-1.5">
            <span className="block text-xs text-gray-400 font-semibold font-sans">Slot Allocation</span>
            <div className="grid grid-cols-2 gap-3">
              <button
                id="schedule-status-active-btn"
                type="button"
                onClick={() => setSelectedStatus('active')}
                className={`py-2 rounded-lg border text-xs font-semibold cursor-pointer select-none transition ${
                  selectedStatus === 'active'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-[#0F1117] text-gray-500 border-[#2D3142] hover:border-gray-500'
                }`}
              >
                Active (Registered)
              </button>
              <button
                id="schedule-status-cancelled-btn"
                type="button"
                onClick={() => setSelectedStatus('cancelled')}
                className={`py-2 rounded-lg border text-xs font-semibold cursor-pointer select-none transition ${
                  selectedStatus === 'cancelled'
                    ? 'bg-[#FF6B6B]/15 text-[#FF6B6B] border-[#FF6B6B]/30'
                    : 'bg-[#0F1117] text-gray-500 border-[#2D3142] hover:border-gray-500'
                }`}
              >
                Skipped (Cancelled)
              </button>
            </div>
          </div>

          <button
            id="single-meal-submit-btn"
            type="submit"
            disabled={savingMeal}
            className="w-full py-2.5 rounded-lg bg-[#6C63FF] hover:bg-[#5b54e7] transition text-white text-xs font-bold tracking-wide cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
          >
            <Check className="w-4 h-4" />
            {savingMeal ? 'Processing Allocation...' : 'Save Meal Schedule'}
          </button>
        </form>
      </div>

      {/* Right side: Bulk actions */}
      <div className="space-y-6">

        {/* Bulk generators */}
        <div className="bg-[#1A1D2E] p-6 rounded-2xl border border-[#2D3142]/80 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#E8E9F3] font-sans flex items-center gap-1.5">
              <Sparkles className="w-5 h-5 text-[#6C63FF]" />
              Automated Month Generator
            </h3>
            <p className="text-xs text-[#6B7280]">Generates default meals for all active roommates for the remaining month days</p>
          </div>

          <div className="text-xs text-[#6B7280] leading-relaxed">
            By clicking the button below, the system will automatically schedule Lunch AND Dinner as <strong>"Active"</strong> for all {activeMembers.length} active roommates starting from today until the last day of this month. Existing logs are skipped to prevent duplicate records.
          </div>

          <button
            id="bulk-generate-meals-btn"
            type="button"
            onClick={handleGenerateMonthMeals}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#6C63FF]/15 hover:bg-[#6C63FF]/25 border border-[#6C63FF]/30 text-[#6C63FF] text-xs font-bold rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            {generating ? (
              <span>Rolling Out Roster...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Meals for Month</span>
              </>
            )}
          </button>
        </div>

        {/* Vacation Date-Range Multi-Cancels */}
        <div className="bg-[#1A1D2E] p-6 rounded-2xl border border-[#2D3142]/80 shadow-xl space-y-4">
          <div>
            <h3 className="text-base font-bold text-[#E8E9F3] font-sans flex items-center gap-1.5">
              <CalendarRange className="w-5 h-5 text-[#FF6B6B]" />
              Date-Range Vacation planner
            </h3>
            <p className="text-xs text-[#6B7280]">Bulk cancel all meals for a roommate during a travel/vacation slot</p>
          </div>

          <form onSubmit={handleBulkCancelRange} className="space-y-4">
            {/* Vacation roommate selection */}
            <div className="space-y-1.5">
              <label htmlFor="vacation-member-select" className="text-xs text-gray-400 font-semibold font-sans">Vacation Roommate</label>
              <select
                id="vacation-member-select"
                value={bulkMemberId}
                onChange={(e) => setBulkMemberId(e.target.value)}
                className="w-full bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6C63FF]"
                required
              >
                <option value="">Select Roommate</option>
                {activeMembers.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Start date */}
              <div className="space-y-1.5">
                <label htmlFor="vacation-start-date" className="text-xs text-gray-400 font-semibold font-sans">Travel Start Date</label>
                <input
                  id="vacation-start-date"
                  type="date"
                  value={bulkStartDate}
                  onChange={(e) => setBulkStartDate(e.target.value)}
                  className="w-full bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] text-xs px-2 py-2 rounded-lg focus:outline-none"
                  required
                />
              </div>

              {/* End date */}
              <div className="space-y-1.5">
                <label htmlFor="vacation-end-date" className="text-xs text-gray-400 font-semibold font-sans">Return Date</label>
                <input
                  id="vacation-end-date"
                  type="date"
                  value={bulkEndDate}
                  onChange={(e) => setBulkEndDate(e.target.value)}
                  className="w-full bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] text-xs px-2 py-2 rounded-lg focus:outline-none"
                  required
                />
              </div>
            </div>

            <button
              id="bulk-vacation-submit-btn"
              type="submit"
              disabled={bulkCancelling}
              className="w-full flex items-center justify-center gap-1 py-2.5 bg-[#FF6B6B]/10 hover:bg-[#FF6B6B]/20 border border-[#FF6B6B]/30 text-[#FF6B6B] text-xs font-bold rounded-lg transition cursor-pointer disabled:opacity-50"
            >
              <AlertTriangle className="w-4 h-4 animate-pulse" />
              {bulkCancelling ? 'Processing Skip Schedules...' : 'Execute Vacation Bulk Cancel'}
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
