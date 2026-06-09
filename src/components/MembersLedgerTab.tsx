import React, { useState, useEffect } from 'react';
import { Member, Meal, Payment, SettingsConfig } from '../types';
import { addPaymentInDb, deletePaymentInDb, updateMemberInDb, verifyPaymentInDb, uploadPaymentReceipt } from '../firebase';
import { Search, PlusCircle, CreditCard, Edit, Check, CheckCircle2, AlertTriangle, Scale, CalendarDays, Phone, Trash2, Image, FileText } from 'lucide-react';

interface MembersLedgerProps {
  members: Member[];
  meals: Meal[];
  payments: Payment[];
  settings: SettingsConfig;
  showToast: (type: 'success' | 'error' | 'warning' | 'info', msg: string) => void;
  currentMember: Member | undefined;
}

export default function MembersLedgerTab({ members, meals, payments, settings, showToast, currentMember }: MembersLedgerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(''); // YYYY-MM
  const [activeDetailMember, setActiveDetailMember] = useState<Member | null>(null);

  // Edit fields
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Payment inputs
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [receivedByMemberId, setReceivedByMemberId] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Setup current month defaults
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    setSelectedMonth(todayStr.slice(0, 7)); // "YYYY-MM"
  }, []);

  // 300ms Debounce search input
  useEffect(() => {
    const fireDebounce = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(fireDebounce);
  }, [searchTerm]);

  const handleOpenDetailModal = (member: Member) => {
    setActiveDetailMember(member);
    setEditName(member.name);
    setEditPhone(member.phone);
    setPaymentAmount('');
    setPaymentNote('');
    setReceivedByMemberId('');
    setSelectedFile(null);
  };

  const handleSaveMemberEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDetailMember) return;
    if (!editName.trim() || !editPhone.trim()) {
      showToast('warning', 'Please fill in both name and phone.');
      return;
    }

    try {
      await updateMemberInDb(activeDetailMember.id, editName.trim(), editPhone.trim());
      showToast('success', 'Roommate details updated successfully.');
      setActiveDetailMember(prev => prev ? { ...prev, name: editName.trim(), phone: editPhone.trim() } : null);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to update roommate credentials.');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDetailMember) return;
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      showToast('warning', 'Please enter a valid positive payment amount.');
      return;
    }

    const selectedReceiver = members.find(m => m.id === receivedByMemberId);
    if (!selectedReceiver) {
      showToast('warning', 'Please select which roommate physically collected this cash handover.');
      return;
    }

    setIsUploading(true);
    try {
      let proofUrl = '';
      if (selectedFile) {
        try {
          proofUrl = await uploadPaymentReceipt(selectedFile);
        } catch (uploadErr) {
          console.error("Upload error:", uploadErr);
          showToast('error', 'Failed to upload receipt imagery. Saving record without screenshot.');
        }
      }

      const todayStr = new Date().toISOString().split('T')[0];
      
      await addPaymentInDb({
        memberId: activeDetailMember.id,
        memberName: activeDetailMember.name,
        amount,
        note: paymentNote.trim(),
        date: todayStr,
        status: 'pending', // Always pending until verified
        proofUrl,
        receivedById: selectedReceiver.id,
        receivedByName: selectedReceiver.name
      });
      
      showToast('success', `Recorded payment of ${amount} BDT from ${activeDetailMember.name}. Pending verification by ${selectedReceiver.name}.`);
      setPaymentAmount('');
      setPaymentNote('');
      setReceivedByMemberId('');
      setSelectedFile(null);
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to save payment record.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeletePayment = async (payId: string, amount: number) => {
    if (!confirm(`Are you sure you want to remove this payment of ${amount} BDT?`)) return;
    try {
      await deletePaymentInDb(payId);
      showToast('success', 'Payment deleted from ledger logs.');
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to delete payment.');
    }
  };

  // Filter roommates based on search
  const filteredMembers = members.filter(m => {
    const matchSearch = m.name.toLowerCase().includes(debouncedSearch.toLowerCase()) || 
                        m.phone.includes(debouncedSearch);
    return matchSearch;
  });

  return (
    <div id="members-ledger-container" className="space-y-6">
      {/* Search and Filters Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-5 bg-[#1A1D2E] rounded-2xl border border-[#2D3142]/60 gap-4 shadow-xl">
        <div className="space-y-0.5">
          <h2 className="text-xl font-bold text-[#E8E9F3]">Roommates & Ledger Balances</h2>
          <p className="text-xs text-[#6B7280]">Detailed meals eaten count, money payments, and live outstanding debt calculations</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
            <input
              id="ledger-search-input"
              type="text"
              placeholder="Search roommates..."
              aria-label="Search roommates"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2 pl-9 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6C63FF] font-medium"
            />
          </div>

          {/* Month Selector for Calculations */}
          <div className="relative w-full sm:w-44">
            <input
              id="ledger-month-select"
              type="month"
              aria-label="Filter by month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full bg-[#0F1117] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6C63FF]"
            />
          </div>
        </div>
      </div>

      {/* Grid of Roommate Balance Cards */}
      {filteredMembers.length === 0 ? (
        <div className="text-center py-16 bg-[#1A1D2E] rounded-2xl border border-[#2D3142]/40 text-xs text-gray-500">
          No roommates found matching criteria.
        </div>
      ) : (
        <div className="space-y-6">
          {/* 1. Logged in member (Self) - Highlighted separately at the top */}
          {filteredMembers.some(m => m.id === currentMember?.id) && (
            <div className="space-y-3">
              <h4 className="text-xs font-mono font-bold text-[#6C63FF] uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#6C63FF] animate-pulse" />
                ⭐ Your Roommate Profile & Account Balance
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredMembers
                  .filter(m => m.id === currentMember?.id)
                  .map((member) => {
                    // Filter meals and payments for the selected month YYYY-MM
                    const memberMeals = meals.filter(m => m.memberId === member.id && m.date.startsWith(selectedMonth));
                    const memberPayments = payments.filter(p => p.memberId === member.id && p.date.startsWith(selectedMonth));

                    const totalEaten = memberMeals.filter(m => m.status === 'active').length;
                    const lateCancelled = memberMeals.filter(m => m.late_cancel).length;
                    
                    // Total cost includes eaten and non-free late-cancellations (charged)
                    const chargeCount = totalEaten + lateCancelled;
                    const totalCost = chargeCount * settings.mealCost;
                    
                    const totalPaid = memberPayments.filter(p => p.status === 'confirmed').reduce((acc, p) => acc + p.amount, 0);
                    const totalPending = memberPayments.filter(p => p.status === 'pending').reduce((acc, p) => acc + p.amount, 0);
                    const balanceDue = totalCost - totalPaid;
                    const netBalance = totalPaid - totalCost;

                    // Simple visual active meal attendance rate (out of possible 60 lunches+dinners)
                    const attendancePct = Math.min(100, Math.round((totalEaten / 60) * 100));

                    return (
                      <div
                        key={member.id}
                        id={`member-ledger-card-${member.id}`}
                        onClick={() => handleOpenDetailModal(member)}
                        className="bg-[#1A1D2E] rounded-2xl border border-[#6C63FF] shadow-lg shadow-[#6C63FF]/5 bg-[#20233c] hover:-translate-y-1 transition-transform cursor-pointer group flex flex-col justify-between p-5"
                      >
                        <div>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              {/* Avatar */}
                              <div className="w-10 h-10 rounded-full bg-[#6C63FF]/25 text-[#a8a4ff] font-sans font-extrabold flex items-center justify-center text-sm uppercase group-hover:bg-[#6C63FF]/45 transition">
                                {member.name.charAt(0)}
                              </div>
                              <div>
                                <h3 className="font-sans font-bold text-sm text-[#E8E9F3] flex items-center gap-1.5">
                                  {member.name}
                                  <span className="text-[9px] bg-[#6C63FF]/30 text-[#c8c5ff] font-sans px-1.5 py-0.5 rounded-full uppercase font-black">
                                    You
                                  </span>
                                </h3>
                                <span className="flex items-center gap-1 text-[10px] text-gray-500 font-mono">
                                  <Phone className="w-3 h-3 text-[#6C63FF]" />
                                  {member.phone}
                                </span>
                              </div>
                            </div>

                            {/* Member Active Status soft check */}
                            {!member.active && (
                              <span className="px-1.5 py-0.5 text-[9px] bg-gray-500/10 text-gray-400 rounded border border-gray-500/20">
                                Inactive
                              </span>
                            )}

                            {/* Due alert over 300 BDT */}
                            {balanceDue > 300 && member.active && (
                              <span className="px-2 py-0.5 text-[9px] bg-[#FF6B6B]/15 text-[#FF6B6B] border border-[#FF6B6B]/30 rounded-full font-bold animate-pulse flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                 Due &gt; 300
                              </span>
                            )}
                          </div>

                          {/* Financial Quick breakdown */}
                          <div className="mt-5 grid grid-cols-3 gap-2 py-3 bg-[#0F1117] px-3.5 rounded-xl border border-[#2D3142]/40 text-center font-mono">
                            <div>
                              <span className="text-[10px] text-gray-500 block">Meals</span>
                              <span className="text-xs font-bold text-amber-500">{chargeCount}</span>
                            </div>
                            <div className="border-x border-[#2D3142]/60">
                              <span className="text-[10px] text-gray-500 block">Cost</span>
                              <span className="text-xs font-bold text-[#E8E9F3]">৳{totalCost}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-500 block">Paid</span>
                              <span className="text-xs font-bold text-[#00D4AA]">৳{totalPaid}</span>
                              {totalPending > 0 && (
                                <span className="block text-[8px] text-amber-500 font-bold leading-none mt-0.5" title="Pending approval">
                                  ৳{totalPending} pend.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Balance & Attendance gauge */}
                        <div className="mt-4 space-y-3">
                          {/* Attendance visual indicator track */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] text-[#6B7280]">
                              <span>Est. Attendance Ratio</span>
                              <span className="font-mono">{totalEaten} active instances</span>
                            </div>
                            <div className="w-full bg-[#0F1117] h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-[#6C63FF] to-indigo-400 h-full rounded-full transition-all"
                                style={{ width: `${Math.max(5, attendancePct)}%` }}
                              />
                            </div>
                          </div>

                          {/* Account Balance and Future Meals Breakdown */}
                          <div className="bg-[#0F1117] rounded-xl p-3 border border-[#2D3142]/50 text-xs space-y-2">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-gray-400 font-sans">Account Balance:</span>
                              {netBalance > 0 ? (
                                <span className="text-[#00D4AA] font-black font-mono bg-[#00D4AA]/10 px-2 py-0.5 rounded border border-[#00D4AA]/20">৳{netBalance} जमा</span>
                              ) : netBalance < 0 ? (
                                <span className="text-[#FF6B6B] font-black font-mono bg-[#FF6B6B]/10 px-2 py-0.5 rounded border border-[#FF6B6B]/20">৳{Math.abs(netBalance)} বাকি</span>
                              ) : (
                                <span className="text-gray-500 font-mono">৳0 settled</span>
                              )}
                            </div>
                            <div className="flex flex-col gap-0.5 text-left text-[11px] border-t border-[#2D3142]/20 pt-1.5">
                              <span className="text-gray-500 font-sans">Estimated Remaining Meals:</span>
                              <span className={`font-semibold font-sans leading-relaxed text-[11px] ${netBalance > 0 ? 'text-[#00D4AA]' : 'text-amber-500/85'}`}>
                                {netBalance > 0 ? (
                                  `💡 ${Math.floor(netBalance / settings.mealCost)}টি মিল (৳${netBalance} দিয়ে সামনে খাওয়া যাবে)`
                                ) : (
                                  '🚫 ০টি মিল (মিল সচল রাখতে বকেয়া পরিশোধ করুন)'
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Balance Badge Indicator */}
                          <div className="flex items-center justify-between pt-2 border-t border-[#2D3142]/30">
                            <span className="text-xs text-[#6B7280] font-sans">Statement Balance</span>
                            <span className={`text-xs font-black font-mono px-2.5 py-1 rounded bg-[#0F1117] border ${
                              balanceDue <= 0
                                ? 'text-[#00D4AA] border-[#00D4AA]/20'
                                : 'text-[#FF6B6B] border-[#FF6B6B]/20'
                            }`}>
                              {balanceDue <= 0 ? 'Settled ✔' : `${balanceDue} BDT due`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* 2. Other Roommates sorted in order */}
          {filteredMembers.some(m => m.id !== currentMember?.id) && (
            <div className="space-y-3">
              <h4 className="text-xs font-mono font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-600" />
                👥 Other Roommates' Balances
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredMembers
                  .filter(m => m.id !== currentMember?.id)
                  .map((member) => {
                    // Filter meals and payments for the selected month YYYY-MM
                    const memberMeals = meals.filter(m => m.memberId === member.id && m.date.startsWith(selectedMonth));
                    const memberPayments = payments.filter(p => p.memberId === member.id && p.date.startsWith(selectedMonth));

                    const totalEaten = memberMeals.filter(m => m.status === 'active').length;
                    const lateCancelled = memberMeals.filter(m => m.late_cancel).length;
                    
                    // Total cost includes eaten and non-free late-cancellations (charged)
                    const chargeCount = totalEaten + lateCancelled;
                    const totalCost = chargeCount * settings.mealCost;
                    
                    const totalPaid = memberPayments.filter(p => p.status === 'confirmed').reduce((acc, p) => acc + p.amount, 0);
                    const totalPending = memberPayments.filter(p => p.status === 'pending').reduce((acc, p) => acc + p.amount, 0);
                    const balanceDue = totalCost - totalPaid;
                    const netBalance = totalPaid - totalCost;

                    // Simple visual active meal attendance rate (out of possible 60 lunches+dinners)
                    const attendancePct = Math.min(100, Math.round((totalEaten / 60) * 100));

                    return (
                      <div
                        key={member.id}
                        id={`member-ledger-card-${member.id}`}
                        onClick={() => handleOpenDetailModal(member)}
                        className="bg-[#1A1D2E] rounded-2xl border border-[#2D3142]/80 hover:border-[#6C63FF]/55 p-5 shadow-lg transition-transform hover:-translate-y-1 cursor-pointer group flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              {/* Avatar */}
                              <div className="w-10 h-10 rounded-full bg-[#6C63FF]/15 text-[#6C63FF] font-sans font-extrabold flex items-center justify-center text-sm uppercase group-hover:bg-[#6C63FF]/25 transition">
                                {member.name.charAt(0)}
                              </div>
                              <div>
                                <h3 className="font-sans font-bold text-sm text-[#E8E9F3]">{member.name}</h3>
                                <span className="flex items-center gap-1 text-[10px] text-gray-500 font-mono">
                                  <Phone className="w-3 h-3 text-[#6C63FF]" />
                                  {member.phone}
                                </span>
                              </div>
                            </div>

                            {/* Member Active Status soft check */}
                            {!member.active && (
                              <span className="px-1.5 py-0.5 text-[9px] bg-gray-500/10 text-gray-400 rounded border border-gray-500/20">
                                Inactive
                              </span>
                            )}

                            {/* Due alert over 300 BDT */}
                            {balanceDue > 300 && member.active && (
                              <span className="px-2 py-0.5 text-[9px] bg-[#FF6B6B]/15 text-[#FF6B6B] border border-[#FF6B6B]/30 rounded-full font-bold animate-pulse flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                 Due &gt; 300
                              </span>
                            )}
                          </div>

                          {/* Financial Quick breakdown */}
                          <div className="mt-5 grid grid-cols-3 gap-2 py-3 bg-[#0F1117] px-3.5 rounded-xl border border-[#2D3142]/40 text-center font-mono">
                            <div>
                              <span className="text-[10px] text-gray-500 block">Meals</span>
                              <span className="text-xs font-bold text-amber-500">{chargeCount}</span>
                            </div>
                            <div className="border-x border-[#2D3142]/60">
                              <span className="text-[10px] text-gray-500 block">Cost</span>
                              <span className="text-xs font-bold text-[#E8E9F3]">৳{totalCost}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-gray-500 block">Paid</span>
                              <span className="text-xs font-bold text-[#00D4AA]">৳{totalPaid}</span>
                              {totalPending > 0 && (
                                <span className="block text-[8px] text-amber-500 font-bold leading-none mt-0.5" title="Pending approval">
                                  ৳{totalPending} pend.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Balance & Attendance gauge */}
                        <div className="mt-4 space-y-3">
                          {/* Attendance visual indicator track */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] text-[#6B7280]">
                              <span>Est. Attendance Ratio</span>
                              <span className="font-mono">{totalEaten} active instances</span>
                            </div>
                            <div className="w-full bg-[#0F1117] h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-[#6C63FF] to-indigo-400 h-full rounded-full transition-all"
                                style={{ width: `${Math.max(5, attendancePct)}%` }}
                              />
                            </div>
                          </div>

                          {/* Account Balance and Future Meals Breakdown */}
                          <div className="bg-[#0F1117] rounded-xl p-3 border border-[#2D3142]/50 text-xs space-y-2">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-gray-400 font-sans">Account Balance:</span>
                              {netBalance > 0 ? (
                                <span className="text-[#00D4AA] font-black font-mono bg-[#00D4AA]/10 px-2 py-0.5 rounded border border-[#00D4AA]/20">৳{netBalance} জমা</span>
                              ) : netBalance < 0 ? (
                                <span className="text-[#FF6B6B] font-black font-mono bg-[#FF6B6B]/10 px-2 py-0.5 rounded border border-[#FF6B6B]/20">৳{Math.abs(netBalance)} বাকি</span>
                              ) : (
                                <span className="text-gray-500 font-mono">৳0 settled</span>
                              )}
                            </div>
                            <div className="flex flex-col gap-0.5 text-left text-[11px] border-t border-[#2D3142]/20 pt-1.5">
                              <span className="text-gray-500 font-sans">Estimated Remaining Meals:</span>
                              <span className={`font-semibold font-sans leading-relaxed text-[11px] ${netBalance > 0 ? 'text-[#00D4AA]' : 'text-amber-500/85'}`}>
                                {netBalance > 0 ? (
                                  `💡 ${Math.floor(netBalance / settings.mealCost)}টি মিল (৳${netBalance} দিয়ে সামনে খাওয়া যাবে)`
                                ) : (
                                  '🚫 ০টি মিল (মিল সচল রাখতে বকেয়া পরিশোধ করুন)'
                                )}
                              </span>
                            </div>
                          </div>

                          {/* Balance Badge Indicator */}
                          <div className="flex items-center justify-between pt-2 border-t border-[#2D3142]/30">
                            <span className="text-xs text-[#6B7280] font-sans">Statement Balance</span>
                            <span className={`text-xs font-black font-mono px-2.5 py-1 rounded bg-[#0F1117] border ${
                              balanceDue <= 0
                                ? 'text-[#00D4AA] border-[#00D4AA]/20'
                                : 'text-[#FF6B6B] border-[#FF6B6B]/20'
                            }`}>
                              {balanceDue <= 0 ? 'Settled ✔' : `${balanceDue} BDT due`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Detail Member Modal with embedded ledger tabs */}
      {activeDetailMember && (
        <div id="ledger-modal-backdrop" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F1117]/80 backdrop-blur-md">
          <div 
            id="member-ledger-modal"
            className="w-full max-w-2xl overflow-hidden rounded-2xl bg-[#1A1D2E] border border-[#2D3142] shadow-2xl flex flex-col md:max-h-[600px]"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-[#2D3142]/60 flex items-center justify-between bg-[#1f2238]/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#6C63FF]/15 text-[#6C63FF] font-sans font-extrabold flex items-center justify-center text-sm">
                  {activeDetailMember.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#E8E9F3]">{activeDetailMember.name}</h3>
                  <p className="text-xs text-gray-500 font-mono">Statement Period Selected Month: {selectedMonth}</p>
                </div>
              </div>
              <button
                id="close-ledger-modal-btn"
                type="button"
                onClick={() => setActiveDetailMember(null)}
                className="text-gray-400 hover:text-white transition px-2 py-1 bg-[#0F1117] rounded-lg text-xs font-semibold cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Modal Scroll Body Split Layout */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 md:grid md:grid-cols-2 md:gap-6 md:space-y-0 scrollbar-thin">
              
              {/* Left Column: Register payments & Edit Profile details */}
              <div className="space-y-4">
                {currentMember && activeDetailMember.id === currentMember.id ? (
                  <>
                
                {/* Record Payment tool form */}
                <div className="bg-[#0F1117] p-4 rounded-xl border border-[#2D3142]/70 space-y-3">
                  <div className="flex items-center gap-1 text-[#00D4AA] text-xs font-bold font-mono">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Record Cash Payment</span>
                  </div>
                  <form onSubmit={handleRecordPayment} className="space-y-2.5">
                    <div>
                      <label htmlFor="modal-payment-amount" className="block text-[10px] text-gray-500 font-mono mb-1">Amount in BDT</label>
                      <input
                        id="modal-payment-amount"
                        type="number"
                        placeholder="e.g. 500"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        className="w-full bg-[#1A1D2E] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6C63FF]"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="modal-payment-note" className="block text-[10px] text-gray-500 font-mono mb-1">Custom Note / Reference</label>
                      <input
                        id="modal-payment-note"
                        type="text"
                        placeholder="e.g., cash hand-to-hand"
                        value={paymentNote}
                        onChange={(e) => setPaymentNote(e.target.value)}
                        className="w-full bg-[#1A1D2E] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6C63FF]"
                      />
                    </div>
                    <div>
                      <label htmlFor="modal-payment-receiver" className="block text-[10px] font-mono mb-1 font-bold text-amber-500">Who Received / Collected? (Required)</label>
                      <select
                        id="modal-payment-receiver"
                        value={receivedByMemberId}
                        onChange={(e) => setReceivedByMemberId(e.target.value)}
                        className="w-full bg-[#1A1D2E] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6C63FF] font-medium"
                        required
                      >
                        <option value="">-- Choose Roommate Collector (Required) --</option>
                        {members.filter(m => m.active && m.id !== activeDetailMember.id).map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      {receivedByMemberId && (
                        <p className="mt-1 text-[9px] text-amber-500 font-mono leading-tight">
                          ⚠️ Crucial: This entry will remain "Pending Verification" until approved by the collector.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 font-mono mb-1">
                        Optional Receipt Image (Firebase Storage Upload)
                      </label>
                      <div className="flex items-center gap-2">
                        <label 
                          htmlFor="modal-payment-receipt"
                          className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[#1A1D2E] hover:bg-[#252a42] border border-[#2D3142]/80 text-[#E8E9F3] text-[10px] rounded-lg cursor-pointer transition font-mono"
                        >
                          <Image className="w-3.5 h-3.5 text-[#00D4AA]" />
                          {selectedFile ? 'Change Screenshot' : 'Attach Screenshot'}
                        </label>
                        <input
                          id="modal-payment-receipt"
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setSelectedFile(e.target.files[0]);
                            }
                          }}
                          className="hidden"
                        />
                        {selectedFile && (
                          <div className="flex items-center gap-1 bg-[#1A1D2E] border border-emerald-500/30 px-2 py-1 rounded text-[10px] text-emerald-400 font-sans truncate max-w-[150px]">
                            <FileText className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                            <span className="truncate">{selectedFile.name}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedFile(null)}
                              className="text-gray-400 hover:text-[#FF6B6B] ml-1 font-bold font-mono focus:outline-none"
                            >
                              ✕
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      id="modal-payment-submit"
                      type="submit"
                      disabled={isUploading}
                      className="w-full flex items-center justify-center gap-1 px-4 py-2 bg-[#00D4AA] hover:bg-[#00be98] disabled:bg-gray-700 disabled:text-gray-400 text-[#0F1117] font-bold text-xs rounded-lg transition mt-2 cursor-pointer"
                    >
                      {isUploading ? (
                        <>
                          <span className="animate-spin border-2 border-t-transparent border-[#0F1117] rounded-full w-3.5 h-3.5 mr-1" />
                          Uploading Receipt...
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-3.5 h-3.5" />
                          Save Log Cash
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Edit Roommate profiles */}
                <div className="bg-[#0F1117] p-4 rounded-xl border border-[#2D3142]/70 space-y-3">
                  <div className="flex items-center gap-1 text-[#6C63FF] text-xs font-bold font-mono">
                    <Edit className="w-4 h-4" />
                    <span>Edit Roommate Details</span>
                  </div>
                  <form onSubmit={handleSaveMemberEdit} className="space-y-2.5">
                    <div>
                      <label htmlFor="modal-edit-name" className="block text-[10px] text-gray-500 font-mono mb-1">Roommate Name</label>
                      <input
                        id="modal-edit-name"
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full bg-[#1A1D2E] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6C63FF]"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="modal-edit-phone" className="block text-[10px] text-gray-500 font-mono mb-1">Phone Contact</label>
                      <input
                        id="modal-edit-phone"
                        type="text"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full bg-[#1A1D2E] border border-[#2D3142] text-[#E8E9F3] text-xs px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6C63FF]"
                        required
                      />
                    </div>
                    <button
                      id="modal-edit-submit"
                      type="submit"
                      className="w-full flex items-center justify-center gap-1 px-4 py-2 bg-[#6C63FF] hover:bg-[#5b54e7] text-white font-bold text-xs rounded-lg transition"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Update Profile
                    </button>
                  </form>
                </div>
              </>
            ) : (
              <div className="bg-[#0F1117] p-6 rounded-2xl border border-[#2D3142]/60 text-center space-y-4 text-xs text-gray-400">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto text-lg">
                  🔒
                </div>
                <div className="space-y-1.5">
                  <span className="block font-black text-white text-sm text-[#E8E9F3]">Roommate View-Only Mode</span>
                  <p className="text-gray-400 leading-relaxed text-[11px]">
                    To protect roommate ledgers and transaction histories, you can only record new payments or edit profile credentials on your own account profile.
                  </p>
                  <p className="text-[11px] text-amber-500 font-mono leading-normal pt-1.5 border-t border-[#2D3142]/30">
                    💡 Go to your own profile named <strong>"{currentMember?.name || 'Your Name'}"</strong> at the top of the ledger to add a cash transition or modify phone metadata!
                  </p>
                </div>
              </div>
            )}
              </div>

              {/* Right Column: Payments list logs and detailed breakdown */}
              <div className="space-y-4">
                
                {/* Ledger summary list logs */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-gray-400 font-mono border-b border-[#2D3142]/60 pb-1 block">
                    Cash Transactions ({selectedMonth})
                  </span>
                  
                  {payments.filter(p => p.memberId === activeDetailMember.id && p.date.startsWith(selectedMonth)).length === 0 ? (
                    <p className="text-[10px] text-gray-500 italic py-4 text-center">No cash transactions logged this month.</p>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                      {payments
                        .filter(p => p.memberId === activeDetailMember.id && p.date.startsWith(selectedMonth))
                        .map((pay) => (
                          <div key={pay.id} className="flex flex-col gap-1.5 p-2.5 bg-[#0F1117] rounded-lg border border-[#2D3142]/30 text-xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-[#00D4AA] font-mono">৳{pay.amount}</span>
                                {pay.status === 'pending' && (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/20 animate-pulse">
                                    Pending Validation
                                  </span>
                                )}
                                {pay.status === 'rejected' && (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#FF6B6B]/15 text-[#FF6B6B] border border-[#FF6B6B]/20">
                                    Rejected
                                  </span>
                                )}
                                {pay.status === 'confirmed' && (
                                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#00D4AA]/15 text-[#00D4AA] border border-[#00D4AA]/20">
                                    Confirmed
                                  </span>
                                )}
                              </div>
                              <button
                                id={`delete-pay-btn-${pay.id}`}
                                type="button"
                                onClick={() => handleDeletePayment(pay.id, pay.amount)}
                                className="text-gray-500 hover:text-[#FF6B6B] transition p-1 rounded hover:bg-[#FF6B6B]/15"
                                title="Delete Transaction"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            
                            <div className="text-[10px] text-gray-400 leading-tight">
                              <div>{pay.note || 'No note'}</div>
                              <div className="text-[9px] text-gray-500 font-mono mt-0.5">Date: {pay.date}</div>
                              {pay.status === 'pending' && pay.receivedByName && (
                                <div className="text-[9px] text-amber-500/90 font-medium mt-0.5">
                                  👉 Handed to: <span className="font-bold">{pay.receivedByName}</span> (Needs to confirm receipt)
                                </div>
                              )}
                              {pay.status === 'confirmed' && pay.receivedByName && (
                                <div className="text-[9px] text-[#00D4AA]/90 font-medium mt-0.5">
                                  ✔ Collected by: {pay.receivedByName}
                                </div>
                              )}
                            </div>

                            {pay.proofUrl && (
                              <div className="mt-1 flex items-center justify-between bg-[#1A1D2E]/50 p-1.5 rounded border border-[#2D3142]/50">
                                <span className="text-[8px] text-gray-400 font-mono">Receipt Screenshot:</span>
                                <a 
                                  href={pay.proofUrl} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-[9px] text-[#00D4AA] hover:underline flex items-center gap-1 font-bold"
                                >
                                  <img 
                                    src={pay.proofUrl} 
                                    alt="Proof" 
                                    referrerPolicy="no-referrer"
                                    className="w-5 h-5 object-cover rounded"
                                  />
                                  View Receipt ↗
                                </a>
                              </div>
                            )}

                            {pay.status === 'pending' && (
                              <div className="flex flex-col gap-1.5 pt-1.5 mt-1 border-t border-[#2D3142]/20">
                                <span className="text-[8px] text-gray-400 font-mono">Confirm Receipt as Collector/Admin:</span>
                                {currentMember && pay.receivedById === currentMember.id ? (
                                  <div className="flex items-center gap-1 justify-end">
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (confirm(`Confirm and finalize cash collection of ৳${pay.amount} from ${pay.memberName}? This acts as Admin Finalization.`)) {
                                          try {
                                            await verifyPaymentInDb(pay.id, 'confirmed', pay.receivedByName || 'Mess Manager');
                                            showToast('success', 'Finalized and confirmed payment successfully!');
                                          } catch (err) {
                                            showToast('error', 'Authentication failed');
                                          }
                                        }
                                      }}
                                      className="px-2.5 py-0.5 text-[8px] bg-[#00D4AA]/10 hover:bg-[#00D4AA]/35 text-[#00D4AA] rounded border border-[#00D4AA]/25 font-bold cursor-pointer"
                                      title="Approve / Finalize Transaction"
                                    >
                                      Confirm Payment
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (confirm(`Reject/Dispute cash collection entry of ৳${pay.amount} from ${pay.memberName}?`)) {
                                          try {
                                            await verifyPaymentInDb(pay.id, 'rejected', pay.receivedByName || 'Mess Manager');
                                            showToast('warning', 'Disputed transaction entry.');
                                          } catch (err) {
                                            showToast('error', 'Rejection failed');
                                          }
                                        }
                                      }}
                                      className="px-2 py-0.5 text-[8px] bg-[#FF6B6B]/15 hover:bg-[#FF6B6B]/30 text-[#FF6B6B] rounded border border-[#FF6B6B]/25 font-bold cursor-pointer"
                                      title="Reject Transaction"
                                    >
                                      Reject / Disown
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-[9px] bg-[#0F1117] text-amber-500/80 px-2 py-1 rounded border border-[#2D3142]/60 font-mono text-center">
                                    🔒 Only {pay.receivedByName || 'selected roommate'} can verify this cash
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Monthly meals breakdown query list */}
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-gray-400 font-mono border-b border-[#2D3142]/60 pb-1 block">
                    Monthly Meals Breakdown
                  </span>
                  
                  {meals.filter(m => m.memberId === activeDetailMember.id && m.date.startsWith(selectedMonth)).length === 0 ? (
                    <p className="text-[10px] text-gray-500 italic py-4 text-center">No meals registered in context.</p>
                  ) : (
                    <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
                      <div className="grid grid-cols-4 text-[9px] font-mono text-gray-500 pb-1 border-b border-[#2D3142]/30 sticky top-0 bg-[#1A1D2E]">
                        <span>Date</span>
                        <span className="text-center">Lunch</span>
                        <span className="text-center">Dinner</span>
                        <span className="text-right">Charge</span>
                      </div>
                      {meals
                        .filter(m => m.memberId === activeDetailMember.id && m.date.startsWith(selectedMonth))
                        // Group by date to show a nice row
                        .reduce((acc: Array<{ date: string; lunch: Meal | null; dinner: Meal | null }>, meal) => {
                          let found = acc.find(row => row.date === meal.date);
                          if (!found) {
                            found = { date: meal.date, lunch: null, dinner: null };
                            acc.push(found);
                          }
                          if (meal.type === 'lunch') found.lunch = meal;
                          if (meal.type === 'dinner') found.dinner = meal;
                          return acc;
                        }, [])
                        .sort((a,b) => b.date.localeCompare(a.date))
                        .map((dayRow) => {
                          const lunchMark = dayRow.lunch?.status === 'active' ? '🍛 Eaten' : dayRow.lunch?.late_cancel ? '⚠️ Charged' : '-';
                          const dinnerMark = dayRow.dinner?.status === 'active' ? '🌙 Eaten' : dayRow.dinner?.late_cancel ? '⚠️ Charged' : '-';
                          
                          // Charge cost
                          let cost = 0;
                          if (dayRow.lunch?.status === 'active' || dayRow.lunch?.late_cancel) cost += settings.mealCost;
                          if (dayRow.dinner?.status === 'active' || dayRow.dinner?.late_cancel) cost += settings.mealCost;

                          return (
                            <div key={dayRow.date} className="grid grid-cols-4 text-[10px] py-1 border-b border-[#2D3142]/20 text-gray-400 font-mono items-center">
                              <span>{dayRow.date.split('-')[2]} {new Date(dayRow.date).toLocaleString('en-US', { month: 'short' })}</span>
                              <span className="text-center text-[9px]">{lunchMark}</span>
                              <span className="text-center text-[9px]">{dinnerMark}</span>
                              <span className="text-right font-bold text-[#E8E9F3]">৳{cost}</span>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-[#0F1117] border-t border-[#2D3142]/65 flex justify-end">
              <button
                id="ledger-modal-done"
                type="button"
                onClick={() => setActiveDetailMember(null)}
                className="px-5 py-2.5 rounded-xl bg-[#6C63FF] hover:bg-[#5b54e7] transition text-white text-xs font-bold"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
