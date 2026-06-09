import { useState } from 'react';
import { Member, Meal, SettingsConfig } from '../types';
import { upsertMealInDb } from '../firebase';
import { ChevronLeft, ChevronRight, Check, X, CircleStop, HelpCircle } from 'lucide-react';

interface CalendarViewTabProps {
  members: Member[];
  meals: Meal[];
  settings: SettingsConfig;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
}

export default function CalendarViewTab({ members, meals, settings, showToast }: CalendarViewTabProps) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthIdx = today.getMonth(); // 0-indexed

  const [year, setYear] = useState(currentYear);
  const [monthIdx, setMonthIdx] = useState(currentMonthIdx); // 0-indexed (Jan = 0, Dec = 11)
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // Month information
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    if (monthIdx === 0) {
      setMonthIdx(11);
      setYear(prev => prev - 1);
    } else {
      setMonthIdx(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (monthIdx === 11) {
      setMonthIdx(0);
      setYear(prev => prev + 1);
    } else {
      setMonthIdx(prev => prev + 1);
    }
  };

  const handleJumpToToday = () => {
    setYear(currentYear);
    setMonthIdx(currentMonthIdx);
    setSelectedDateStr(today.toISOString().split('T')[0]);
  };

  // Generate calendar days
  const firstDayOfMonth = new Date(year, monthIdx, 1).getDay(); // Day of week (0 = Sunday)
  const totalDaysInMonth = new Date(year, monthIdx + 1, 0).getDate();

  const daysGrid: Array<{ dateStr: string | null; dayNum: number | null }> = [];

  // Padding days for Sunday-start
  for (let i = 0; i < firstDayOfMonth; i++) {
    daysGrid.push({ dateStr: null, dayNum: null });
  }

  // Days of current month
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const formattedMonth = String(monthIdx + 1).padStart(2, '0');
    const formattedDay = String(day).padStart(2, '0');
    daysGrid.push({
      dateStr: `${year}-${formattedMonth}-${formattedDay}`,
      dayNum: day
    });
  }

  // Active members
  const activeMembers = members.filter(m => m.active);

  // Modal handlers
  const handleCellClick = (dateStr: string) => {
    setSelectedDateStr(dateStr);
  };

  const handleStatusToggle = async (member: Member, type: 'lunch' | 'dinner', currentStatus: 'active' | 'cancelled') => {
    if (!selectedDateStr) return;
    const nextStatus = currentStatus === 'active' ? 'cancelled' : 'active';

    // Same day late-cancellation checks
    const todayStr = today.toISOString().split('T')[0];
    let isLate = false;

    if (selectedDateStr === todayStr && nextStatus === 'cancelled') {
      const now = new Date();
      const [lHour, lMin] = settings.lunchCancelDeadline.split(':').map(Number);
      const [dHour, dMin] = settings.dinnerCancelDeadline.split(':').map(Number);

      if (type === 'lunch') {
        const boundary = new Date();
        boundary.setHours(lHour, lMin, 0, 0);
        if (now >= boundary) isLate = true;
      } else {
        const boundary = new Date();
        boundary.setHours(dHour, dMin, 0, 0);
        if (now >= boundary) isLate = true;
      }
    }

    try {
      if (nextStatus === 'cancelled' && isLate) {
        showToast('warning', `⚠️ Same-day deadline has passed. Charging for lunch/dinner still applies.`);
      }
      await upsertMealInDb(member.id, member.name, selectedDateStr, type, nextStatus, isLate);
      showToast('success', `Status updated successfully.`);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to update calendar meal status.');
    }
  };

  return (
    <div id="calendar-view-container" className="space-y-6">
      {/* Calendar Header with Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between p-5 bg-[#1A1D2E] rounded-2xl border border-[#2D3142]/60 gap-4 shadow-xl">
        <div className="space-y-0.5">
          <h2 className="text-xl font-bold text-[#E8E9F3] font-sans">Monthly Meal Attendance Calendar</h2>
          <p className="text-xs text-[#6B7280]">Color-coded attendance metrics for the household mess grid</p>
        </div>

        {/* Navigation operations */}
        <div className="flex items-center gap-3">
          <button
            id="prev-month-btn"
            type="button"
            onClick={handlePrevMonth}
            className="p-2 bg-[#0F1117] border border-[#2D3142] hover:bg-[#202336] rounded-lg text-gray-400 hover:text-white transition cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="font-sans font-bold text-sm text-[#E8E9F3] min-w-[125px] text-center bg-[#0F1117] px-4 py-2 border border-[#2D3142] rounded-lg tracking-wide uppercase">
            {monthNames[monthIdx]} {year}
          </span>

          <button
            id="next-month-btn"
            type="button"
            onClick={handleNextMonth}
            className="p-2 bg-[#0F1117] border border-[#2D3142] hover:bg-[#202336] rounded-lg text-gray-400 hover:text-white transition cursor-pointer"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            id="jump-today-btn"
            type="button"
            onClick={handleJumpToToday}
            className="px-4 py-2 bg-[#6C63FF]/15 border border-[#6C63FF]/30 text-[#6C63FF] hover:bg-[#6C63FF]/25 font-bold rounded-lg text-xs tracking-wider transition cursor-pointer"
          >
            TODAY
          </button>
        </div>
      </div>

      {/* Grid Legend helper */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] pl-1 text-gray-500 font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/35" />
          <span>Full Attendance (All Active)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/35" />
          <span>Partial (Some Roommates Cancelled)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#2D3142]/40 border border-transparent" />
          <span>Rest / Future / Unseeded</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-[#6C63FF] shadow-[0_0_8px_rgba(108,99,255,0.4)] bg-[#1A1D2E]" />
          <span>Current Today (Pulsing Outline)</span>
        </div>
      </div>

      {/* Weekdays indicator heading */}
      <div className="bg-[#1A1D2E] rounded-2xl border border-[#2D3142]/80 p-4 shadow-xl select-none">
        <div className="grid grid-cols-7 text-center gap-2 mb-3">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((wd) => (
            <span key={wd} className="text-xs font-mono font-bold text-gray-500 uppercase tracking-wider">{wd}</span>
          ))}
        </div>

        {/* The Days Grid */}
        <div className="grid grid-cols-7 gap-2">
          {daysGrid.map((day, idx) => {
            if (!day.dateStr || !day.dayNum) {
              return (
                <div key={`empty-${idx}`} className="aspect-square bg-[#0F1117]/30 rounded-xl border border-transparent" />
              );
            }

            const isToday = day.dateStr === today.toISOString().split('T')[0];
            const isPast = day.dateStr < today.toISOString().split('T')[0];

            // Get meals on this day
            const dayMeals = meals.filter(m => m.date === day.dateStr);
            const activeLunchCount = dayMeals.filter(m => m.type === 'lunch' && m.status === 'active').length;
            const activeDinnerCount = dayMeals.filter(m => m.type === 'dinner' && m.status === 'active').length;
            const lateCancelCount = dayMeals.filter(m => m.late_cancel).length;

            const totalActiveDayCount = activeLunchCount + activeDinnerCount;
            const totalBillableDayCount = totalActiveDayCount + lateCancelCount;
            const dailyCostSum = totalBillableDayCount * settings.mealCost;

            // Determine coloring
            // All active members registered * 2 (lunch & dinner)
            const expectedMeals = activeMembers.length * 2;
            let bgClass = 'bg-[#0F1117] border-[#2D3142]/65 text-[#6B7280]';

            if (expectedMeals > 0 && dayMeals.length > 0) {
              if (activeLunchCount === activeMembers.length && activeDinnerCount === activeMembers.length) {
                bgClass = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/15';
              } else if (activeLunchCount > 0 || activeDinnerCount > 0) {
                bgClass = 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/15';
              }
            }

            if (isToday) {
              bgClass += ' ring-2 ring-[#6C63FF] shadow-[0_0_12px_rgba(108,99,255,0.3)] text-white';
            }

            return (
              <div
                key={day.dateStr}
                id={`calendar-cell-${day.dateStr}`}
                onClick={() => handleCellClick(day.dateStr!)}
                className={`aspect-square p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between hover:scale-[1.03] active:scale-95 ${bgClass}`}
                title={`Click for ledger for ${day.dateStr}`}
              >
                {/* Day Number */}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-extrabold">{day.dayNum}</span>
                  {dailyCostSum > 0 && (
                    <span className="text-[9px] font-mono font-semibold text-gray-400 tracking-tight">৳{dailyCostSum}</span>
                  )}
                </div>

                {/* Mini counts */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1 text-[10px] font-mono leading-tight">
                    <span className="text-amber-500">🍛</span>
                    <span>{activeLunchCount}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono leading-tight">
                    <span className="text-indigo-400">🌙</span>
                    <span>{activeDinnerCount}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail overlay Modal */}
      {selectedDateStr && (
        <div id="calendar-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F1117]/80 backdrop-blur-md">
          <div 
            id="calendar-date-modal"
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-[#1A1D2E] border border-[#2D3142] shadow-2xl"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-[#2D3142]/60 flex items-center justify-between bg-[#1f2238]/60">
              <div>
                <h3 className="text-lg font-bold text-[#E8E9F3] font-sans">Roommate Status for {selectedDateStr}</h3>
                <p className="text-xs text-[#6B7280]">Toggle lunch or dinner slots directly on this date</p>
              </div>
              <button
                id="close-cal-modal-btn"
                type="button"
                onClick={() => setSelectedDateStr(null)}
                className="text-gray-400 hover:text-white transition px-2.5 py-1.5 rounded-lg hover:bg-[#2d3142]/60 text-sm font-semibold cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[380px] overflow-y-auto pr-2 scrollbar-thin">
              
              {/* Deadline warnings inside modal */}
              {selectedDateStr === today.toISOString().split('T')[0] && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-[10px] flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 shrink-0" />
                  <span>
                    <strong>Warning:</strong> You are editing SAME-DAY meal rosters. Lunch deadline closes at {settings.lunchCancelDeadline} AM, Dinner at {settings.dinnerCancelDeadline} PM. Admin override still allowed.
                  </span>
                </div>
              )}

              {activeMembers.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-500">
                  No active roommates registered to track.
                </div>
              ) : (
                <div className="space-y-3.5">
                  {activeMembers.map((member) => {
                    const mealsForDate = meals.filter(m => m.date === selectedDateStr && m.memberId === member.id);
                    const lunchMeal = mealsForDate.find(m => m.type === 'lunch');
                    const dinnerMeal = mealsForDate.find(m => m.type === 'dinner');

                    const lunchStatus = lunchMeal ? lunchMeal.status : 'active';
                    const dinnerStatus = dinnerMeal ? dinnerMeal.status : 'active';

                    const isLunchLateCancel = lunchMeal?.late_cancel;
                    const isDinnerLateCancel = dinnerMeal?.late_cancel;

                    return (
                      <div
                        key={member.id}
                        id={`member-modal-row-${member.id}`}
                        className="p-3.5 bg-[#0F1117] rounded-xl border border-[#2D3142]/40 gap-4 flex flex-col sm:flex-row sm:items-center sm:justify-between hover:border-[#6C63FF]/25 transition"
                      >
                        <div className="space-y-0.5">
                          <h4 className="font-sans font-bold text-xs text-[#E8E9F3]">{member.name}</h4>
                          <span className="block text-[10px] text-gray-500 font-mono italic">{member.phone}</span>
                        </div>

                        {/* Roster adjustment triggers */}
                        <div className="flex gap-2.5">
                          {/* Lunch button */}
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-amber-500">🍛 Lunch Slot</span>
                            <button
                              id={`modal-btn-${member.id}-lunch`}
                              type="button"
                              onClick={() => handleStatusToggle(member, 'lunch', lunchStatus)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all inline-flex items-center gap-1 min-w-[95px] justify-center cursor-pointer ${
                                lunchStatus === 'active'
                                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20'
                                  : isLunchLateCancel
                                  ? 'bg-[#FF6B6B]/15 text-[#FF6B6B] border-[#FF6B6B]/20 hover:bg-[#FF6B6B]/25'
                                  : 'bg-[#212332] text-gray-500 border-transparent hover:bg-gray-800'
                              }`}
                            >
                              {lunchStatus === 'active' ? (
                                <><Check className="w-3.5 h-3.5" /> Eaten</>
                              ) : isLunchLateCancel ? (
                                <><X className="w-3.5 h-3.5" /> Late ⚠️</>
                              ) : (
                                <><CircleStop className="w-3.5 h-3.5 text-gray-600" /> Skipped</>
                              )}
                            </button>
                          </div>

                          {/* Dinner button */}
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-indigo-400">🌙 Dinner Slot</span>
                            <button
                              id={`modal-btn-${member.id}-dinner`}
                              type="button"
                              onClick={() => handleStatusToggle(member, 'dinner', dinnerStatus)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all inline-flex items-center gap-1 min-w-[95px] justify-center cursor-pointer ${
                                dinnerStatus === 'active'
                                  ? 'bg-indigo-500/10 text-[#818CF8] border-indigo-500/20 hover:bg-indigo-500/20'
                                  : isDinnerLateCancel
                                  ? 'bg-[#FF6B6B]/15 text-[#FF6B6B] border-[#FF6B6B]/20 hover:bg-[#FF6B6B]/25'
                                  : 'bg-[#212332] text-gray-500 border-transparent hover:bg-gray-800'
                              }`}
                            >
                              {dinnerStatus === 'active' ? (
                                <><Check className="w-3.5 h-3.5" /> Eaten</>
                              ) : isDinnerLateCancel ? (
                                <><X className="w-3.5 h-3.5" /> Late ⚠️</>
                              ) : (
                                <><CircleStop className="w-3.5 h-3.5 text-gray-600" /> Skipped</>
                              )}
                            </button>
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#0F1117] border-t border-[#2D3142]/65 flex justify-end">
              <button
                id="modal-done-btn"
                type="button"
                onClick={() => setSelectedDateStr(null)}
                className="px-5 py-2 rounded-xl bg-[#6C63FF] hover:bg-[#5b54e7] transition text-white text-xs font-bold shadow-md cursor-pointer"
              >
                Roster Confirmed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
